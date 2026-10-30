import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface AgentStackProps extends cdk.StackProps {
  /** Tag of the agent image in the ECR repository. Push an image with this tag before deploying. */
  imageTag?: string;
}

/**
 * Bedrock AgentCore infrastructure for the agent (acagent_new).
 * Defined in dependency order: the MCP gateway and memory first, then the runtime that consumes them.
 */
export class AgentStack extends cdk.Stack {
  readonly repository: ecr.Repository;
  readonly memory: bedrockagentcore.CfnMemory;
  readonly gateway: bedrockagentcore.CfnGateway;
  readonly runtimeRole: iam.Role;
  readonly runtime: bedrockagentcore.CfnRuntime;

  constructor(scope: Construct, id: string, props: AgentStackProps = {}) {
    super(scope, id, props);

    const { region, account } = this;

    this.repository = new ecr.Repository(this, 'AgentRepository', {
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // TODO: RETAIN for production
      emptyOnDelete: true,
    });

    /*****************************
     * AgentCore Memory
     ******************************/

    this.memory = new bedrockagentcore.CfnMemory(this, 'AgentMemory', {
      name: 'acagent_memory',
      eventExpiryDuration: 30,
      description: 'Long-term memory for the Air Concierge agent',
      memoryStrategies: [
        { semanticMemoryStrategy: { name: 'SemanticFacts', namespaces: ['/facts/{actorId}/'] } },
        { userPreferenceMemoryStrategy: { name: 'UserPreferences', namespaces: ['/preferences/{actorId}/'] } },
        { summaryMemoryStrategy: { name: 'SessionSummaries', namespaces: ['/summaries/{actorId}/{sessionId}/'] } },
      ],
    });

    /*****************************
     * AgentCore MCP Gateway (Cognito client-credentials auth)
     ******************************/

    const userPool = new cognito.UserPool(this, 'GatewayUserPool');

    const gatewayScope = { scopeName: 'basic', scopeDescription: 'Basic access to the agent gateway' };
    const resourceServer = userPool.addResourceServer('GatewayResourceServer', {
      identifier: 'acagent-gateway',
      scopes: [gatewayScope],
    });

    const appClient = new cognito.UserPoolClient(this, 'GatewayAppClient', {
      userPool,
      generateSecret: true,
      oAuth: {
        flows: { clientCredentials: true },
        scopes: [cognito.OAuthScope.resourceServer(resourceServer, gatewayScope)],
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
    });

    const userPoolDomain = userPool.addDomain('GatewayUserPoolDomain', {
      cognitoDomain: { domainPrefix: `acagent-${account}-${region}` },
    });

    const gatewayRole = new iam.Role(this, 'GatewayRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      description: 'Role assumed by the AgentCore MCP gateway',
    });

    this.gateway = new bedrockagentcore.CfnGateway(this, 'AgentGateway', {
      name: 'acagent-gateway',
      protocolType: 'MCP',
      roleArn: gatewayRole.roleArn,
      authorizerType: 'CUSTOM_JWT',
      authorizerConfiguration: {
        customJwtAuthorizer: {
          discoveryUrl: `https://cognito-idp.${region}.amazonaws.com/${userPool.userPoolId}/.well-known/openid-configuration`,
          allowedClients: [appClient.userPoolClientId],
        },
      },
    });
    // TODO: add gateway targets (the acmcp server) with CfnGatewayTarget

    /*****************************
     * AgentCore Runtime
     ******************************/

    // https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-permissions.html#runtime-permissions-execution
    this.runtimeRole = new iam.Role(this, 'AgentRuntimeRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com', {
        conditions: { StringEquals: { 'aws:SourceAccount': account } },
      }),
      description: 'Execution role for the Air Concierge AgentCore runtime',
    });

    this.repository.grantPull(this.runtimeRole);
    this.runtimeRole.addToPolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['arn:aws:bedrock:*::foundation-model/*', `arn:aws:bedrock:*:${account}:inference-profile/*`],
    }));
    
    this.runtimeRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'bedrock-agentcore:CreateEvent',
        'bedrock-agentcore:ListEvents',
        'bedrock-agentcore:GetMemory',
        'bedrock-agentcore:RetrieveMemoryRecords',
        'bedrock-agentcore:ListSessions',
      ],
      resources: [this.memory.attrMemoryArn],
    }));
    this.runtimeRole.addToPolicy(new iam.PolicyStatement({
      actions: ['logs:CreateLogGroup', 'logs:DescribeLogGroups', 'logs:DescribeLogStreams', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [`arn:aws:logs:${region}:${account}:log-group:/aws/bedrock-agentcore/runtimes/*`, `arn:aws:logs:${region}:${account}:log-group:*`],
    }));
    this.runtimeRole.addToPolicy(new iam.PolicyStatement({
      actions: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords'],
      resources: ['*'],
    }));

    this.runtime = new bedrockagentcore.CfnRuntime(this, 'AgentRuntime', {
      agentRuntimeName: 'acagent_runtime',
      agentRuntimeArtifact: {
        containerConfiguration: {
          containerUri: this.repository.repositoryUriForTag(props.imageTag ?? 'latest'),
        },
      },
      protocolConfiguration: 'HTTP',
      networkConfiguration: { networkMode: 'PUBLIC' },
      roleArn: this.runtimeRole.roleArn,
      environmentVariables: {
        AWS_REGION: region,
        // memory
        BEDROCK_AGENTCORE_MEMORY_ID: this.memory.attrMemoryId,
        BEDROCK_AGENTCORE_MEMORY_ARN: this.memory.attrMemoryArn,
        // MCP gateway
        GATEWAY_ID: this.gateway.attrGatewayIdentifier,
        GATEWAY_ARN: this.gateway.attrGatewayArn,
        GATEWAY_URL: this.gateway.attrGatewayUrl,
        // gateway auth. The client secret is deliberately not passed as plain text here.
        COGNITO_CLIENT_ID: appClient.userPoolClientId,
        COGNITO_TOKEN_URL: `${userPoolDomain.baseUrl()}/oauth2/token`,
        COGNITO_SCOPE: `${resourceServer.userPoolResourceServerId}/${gatewayScope.scopeName}`,
      },
    });

    new cdk.CfnOutput(this, 'RepositoryUri', { value: this.repository.repositoryUri });
    new cdk.CfnOutput(this, 'MemoryId', { value: this.memory.attrMemoryId });
    new cdk.CfnOutput(this, 'GatewayUrl', { value: this.gateway.attrGatewayUrl });
    new cdk.CfnOutput(this, 'RuntimeArn', { value: this.runtime.attrAgentRuntimeArn });
  }
}
