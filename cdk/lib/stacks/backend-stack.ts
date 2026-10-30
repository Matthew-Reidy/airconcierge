import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration, WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export interface BackendStackProps extends cdk.StackProps {
  /** AgentCore memory the HTTP API reads chat history from */
  memoryId: string;
  memoryArn: string;
}

export class BackendStack extends cdk.Stack {
  readonly websocketFunction: lambda.Function;
  readonly httpFunction: lambda.Function;
  readonly websocketApi: apigwv2.WebSocketApi;
  readonly httpApi: apigwv2.HttpApi;
  readonly sessionTable: dynamodb.TableV2;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    /*****************************
     * Session table
     * Attributes: session_id (key), session_title, connection_id (current websocket connection), ttl (expiry, epoch seconds)
     ******************************/

    this.sessionTable = new dynamodb.TableV2(this, 'SessionTable', {
      partitionKey: { name: 'session_id', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      billing: dynamodb.Billing.onDemand(),
      removalPolicy: cdk.RemovalPolicy.DESTROY, // TODO: RETAIN for production
      // lets the websocket lambda find a session from its connection id
      globalSecondaryIndexes: [{
        indexName: 'connection_id-index',
        partitionKey: { name: 'connection_id', type: dynamodb.AttributeType.STRING },
        projectionType: dynamodb.ProjectionType.KEYS_ONLY,
      }],
    });

    /*****************************
     * Lambda functions
     ******************************/

    this.websocketFunction = new lambda.Function(this, 'WebsocketFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'websocket_handler.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/lambda')),
      timeout: cdk.Duration.minutes(5), // agent replies are streamed back over the connection
    });

    this.httpFunction = new lambda.Function(this, 'HttpFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'httpapi_handler.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/lambda')),
      timeout: cdk.Duration.seconds(10),
    });

    this.sessionTable.grantReadWriteData(this.websocketFunction);
    this.sessionTable.grantReadData(this.httpFunction);

    this.httpFunction.addEnvironment('AGENTCORE_MEMORY_ID', props.memoryId);
    this.httpFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock-agentcore:ListEvents'],
      resources: [props.memoryArn],
    }));
    for (const fn of [this.websocketFunction, this.httpFunction]) {
      fn.addEnvironment('SESSION_TABLE_NAME', this.sessionTable.tableName);
    }

    /*****************************
     * WebSocket API: $connect, $disconnect, $default, chat
     ******************************/

    const wsIntegration = new WebSocketLambdaIntegration('WebsocketIntegration', this.websocketFunction);

    this.websocketApi = new apigwv2.WebSocketApi(this, 'WebsocketApi', {
      // messages are routed on the "action" field, e.g. {"action": "chat", "prompt": "..."}
      routeSelectionExpression: '$request.body.action',
      connectRouteOptions: { integration: wsIntegration },
      disconnectRouteOptions: { integration: wsIntegration },
      defaultRouteOptions: { integration: wsIntegration },
    });
    this.websocketApi.addRoute('chat', { integration: wsIntegration });

    const websocketStage = new apigwv2.WebSocketStage(this, 'WebsocketStage', {
      webSocketApi: this.websocketApi,
      stageName: 'prod',
      autoDeploy: true,
    });

    // lets the lambda push messages back to connected clients
    this.websocketApi.grantManageConnections(this.websocketFunction);

    /*****************************
     * HTTP API: GET /getsessions, GET /getchathistory?sessionID=
     ******************************/

    const httpIntegration = new HttpLambdaIntegration('HttpIntegration', this.httpFunction);

    this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      corsPreflight: {
        allowOrigins: ['*'], // TODO: restrict to the frontend origin
        allowMethods: [apigwv2.CorsHttpMethod.GET],
      },
    });

    this.httpApi.addRoutes({
      path: '/getsessions',
      methods: [apigwv2.HttpMethod.GET],
      integration: httpIntegration,
    });
    this.httpApi.addRoutes({
      path: '/getchathistory',
      methods: [apigwv2.HttpMethod.GET],
      integration: httpIntegration,
    });

    new cdk.CfnOutput(this, 'WebsocketUrl', { value: websocketStage.url });
    new cdk.CfnOutput(this, 'HttpApiUrl', { value: this.httpApi.apiEndpoint });
  }
}
