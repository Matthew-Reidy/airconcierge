import * as cdk from 'aws-cdk-lib/core';
import { CoreDeployProps } from '../types';
import { Construct } from 'constructs/lib/construct'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2'
import * as apigwauth from 'aws-cdk-lib/aws-apigatewayv2-authorizers'

export interface frontendStackProps extends CoreDeployProps{}

export class frontendStack extends cdk.Stack{

    readonly triggerLambda;
    readonly clientAPI;
    readonly sessionStore;

    constructor(scope: Construct, id: string, props: frontendStackProps) {
        super(scope, id, props);

    
            this.triggerLambda = new lambda.Function(this, `${props.appName}-AgentTriggerLambda`, {
                runtime: lambda.Runtime.PYTHON_3_12,
                handler: "handler.lambda_handler",
                code: lambda.AssetCode.fromInline("")
            })

            this.clientAPI = new apigw.WebSocketApi(this, `${props.appName}-AgentClientWebsocket`, {

            })

            this.sessionStore = new dynamodb.TableV2(this, `${props.appName}-AgentClientSessionStore`, {
                tableName: "AgentSessionStore",
                partitionKey: { name: "WebsocketSeshID", type: dynamodb.AttributeType.STRING },
            })
    }
    
}