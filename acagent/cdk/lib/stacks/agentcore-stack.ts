import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs/lib/construct';
import * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { BaseStackProps } from '../types';
import * as path from 'path';

export interface AgentCoreStackProps extends BaseStackProps {
    imageUri: string
}

export class AgentCoreStack extends cdk.Stack {
    readonly agentCoreRuntime: bedrockagentcore.CfnRuntime;
    readonly agentCoreGateway: bedrockagentcore.CfnGateway;
    readonly agentCoreMemory: bedrockagentcore.CfnMemory;
    readonly mcpLambda: lambda.Function;

    constructor(scope: Construct, id: string, props: AgentCoreStackProps) {
        super(scope, id, props);

        const region = cdk.Stack.of(this).region;
        const accountId = cdk.Stack.of(this).account;

        /*****************************
        * AgentCore Gateway
        ******************************/


        const agentCoreGatewayRole = new iam.Role(this, `${props.appName}-AgentCoreGatewayRole`, {
            assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
            description: 'IAM role for Bedrock AgentCore Runtime',
        });


        // Create gateway resource
        // Cognito resources
        const cognitoUserPool = new cognito.UserPool(this, `${props.appName}-CognitoUserPool`);

        // create resource server to work with client credentials auth flow
        const cognitoResourceServerScope = {
            scopeName: 'basic',
            scopeDescription: 'Basic access to acagent',
        };

        const cognitoResourceServer = cognitoUserPool.addResourceServer(`${props.appName}-CognitoResourceServer`, {
            identifier: `${props.appName}-CognitoResourceServer`,
            scopes: [cognitoResourceServerScope],
        });

        const cognitoAppClient = new cognito.UserPoolClient(this, `${props.appName}-CognitoAppClient`, {
            userPool: cognitoUserPool,
            generateSecret: true,
            oAuth: {
                flows: {
                    clientCredentials: true,
                },
                scopes: [cognito.OAuthScope.resourceServer(cognitoResourceServer, cognitoResourceServerScope)],
            },
            supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
        });
        const cognitoDomain = cognitoUserPool.addDomain(`${props.appName}-CognitoDomain`, {
            cognitoDomain: {
                domainPrefix: `${props.appName.toLowerCase()}-${region}`,
            },
        });
        const cognitoTokenUrl = cognitoDomain.baseUrl() + '/oauth2/token';

        this.agentCoreGateway = new bedrockagentcore.CfnGateway(this, `${props.appName}-AgentCoreGateway`, {
            name: `${props.appName}-Gateway`,
            protocolType: "MCP",
            roleArn: agentCoreGatewayRole.roleArn,
            authorizerType: "CUSTOM_JWT",
            authorizerConfiguration: {
                customJwtAuthorizer: {
                discoveryUrl:
                    'https://cognito-idp.' +
                    region +
                    '.amazonaws.com/' +
                    cognitoUserPool.userPoolId +
                    '/.well-known/openid-configuration',
                allowedClients: [cognitoAppClient.userPoolClientId],
                },
            },
        });

        // Add Policy Engine permissions to Gateway role
        // Required for Policy Engine integration when adding policies to gateway:
        // - GetPolicyEngine: retrieve policy engine
        // - AuthorizeAction: evaluate Cedar policies for authorization requests
        // - PartiallyAuthorizeActions: partial evaluation for listing allowed tools
        agentCoreGatewayRole.addToPolicy(new iam.PolicyStatement({
            sid: 'AgentCorePolicyEngineAccess',
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock-agentcore:GetPolicyEngine',
                'bedrock-agentcore:AuthorizeAction',
                'bedrock-agentcore:PartiallyAuthorizeActions',
            ],
            resources: [
                `arn:aws:bedrock-agentcore:${region}:${accountId}:policy-engine/*`,
                this.agentCoreGateway.attrGatewayArn,
            ],
        }));

        const gatewayTarget = new bedrockagentcore.CfnGatewayTarget(this, `${props.appName}-AgentCoreGatewayLambdaTarget`, {
            name: `${props.appName}-Target`,
            gatewayIdentifier: this.agentCoreGateway.attrGatewayIdentifier,
            credentialProviderConfigurations: [
                {
                    credentialProviderType: "GATEWAY_IAM_ROLE",
                },
            ],
            targetConfiguration: {
                mcp: {
                    lambda: {
                        lambdaArn: "arn:aws:lambda:us-west-1:421989725079:function:test-using-mystack-test3FD64DD3A-FDbmK7bSCnky",
                        toolSchema: {
                            inlinePayload: [
                                {
                                    name: "placeholder_tool",
                                    description: "No-op tool that demonstrates passing arguments",
                                    inputSchema: {
                                        type: "object",
                                        properties: {
                                            string_param: { type: 'string', description: 'Example string parameter' },
                                            int_param: { type: 'integer', description: 'Example integer parameter' },
                                            float_array_param: {
                                                type: 'array',
                                                description: 'Example float array parameter',
                                                items: {
                                                    type: 'number',
                                                }
                                            }
                                        },
                                        required: []
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        });

        // Ensure GatewayTarget waits for IAM policy (from grantInvoke) to be attached to role
        gatewayTarget.node.addDependency(agentCoreGatewayRole);
        
        /*****************************
        * AgentCore Memory
        ******************************/

        this.agentCoreMemory = new bedrockagentcore.CfnMemory(this, `${props.appName}-AgentCoreMemory`, {
            name: "acagent_Memory",
            eventExpiryDuration: 30,
            description: "Memory resource with 30 days event expiry",
            memoryStrategies: [
                {
                    semanticMemoryStrategy: {
                        name: "SemanticFacts",
                        namespaces: ["/facts/{actorId}/"],
                        description: "Instance of built-in semantic memory strategy"
                    }
                },
                {
                    userPreferenceMemoryStrategy: {
                        name: "UserPreferences",
                        namespaces: ["/preferences/{actorId}/"],
                        description: "Instance of built-in user preference memory strategy"
                    }
                },
                {
                    summaryMemoryStrategy: {
                        name: "SessionSummaries",
                        namespaces: ["/summaries/{actorId}/{sessionId}/"],
                        description: "Instance of built-in summary memory strategy"
                    }
                },
                {
                    episodicMemoryStrategy: {
                        name: "EpisodeTracker",
                        namespaces: ["/episodes/{actorId}/{sessionId}/"],
                        reflectionConfiguration: {
                            namespaces: ["/episodes/{actorId}/"],
                        },
                        description: "Instance of built-in episodic memory strategy"
                    }
                }
            ],
        });
        
        /*****************************
        * AgentCore Runtime
        ******************************/

        // taken from https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-permissions.html#runtime-permissions-execution
        const runtimePolicy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    sid: 'ECRImageAccess',
                    effect: iam.Effect.ALLOW,
                    actions: ['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
                    resources: [
                        `arn:aws:ecr:${region}:${accountId}:repository/*`,
                    ],
                }),
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['logs:DescribeLogStreams', 'logs:CreateLogGroup'],
                    resources: [
                        `arn:aws:logs:${region}:${accountId}:log-group:/aws/bedrock-agentcore/runtimes/*`,
                    ],
                }),
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['logs:DescribeLogGroups'],
                    resources: [
                        `arn:aws:logs:${region}:${accountId}:log-group:*`,
                    ],
                }),
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
                    resources: [
                        `arn:aws:logs:${region}:${accountId}:log-group:/aws/bedrock-agentcore/runtimes/*:log-stream:*`,
                    ],
                }),
                new iam.PolicyStatement({
                    sid: 'ECRTokenAccess',
                    effect: iam.Effect.ALLOW,
                    actions: ['ecr:GetAuthorizationToken'],
                    resources: ['*'],
                }),
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'xray:PutTraceSegments',
                        'xray:PutTelemetryRecords',
                        'xray:GetSamplingRules',
                        'xray:GetSamplingTargets',
                    ],
                resources: ['*'],
                }),
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['cloudwatch:PutMetricData'],
                    resources: ['*'],
                    conditions: {
                        StringEquals: { 'cloudwatch:namespace': 'bedrock-agentcore' },
                    },
                }),
                new iam.PolicyStatement({
                    sid: 'GetAgentAccessToken',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'bedrock-agentcore:GetWorkloadAccessToken',
                        'bedrock-agentcore:GetWorkloadAccessTokenForJWT',
                        'bedrock-agentcore:GetWorkloadAccessTokenForUserId',
                    ],
                    resources: [
                        `arn:aws:bedrock-agentcore:${region}:${accountId}:workload-identity-directory/default`,
                        `arn:aws:bedrock-agentcore:${region}:${accountId}:workload-identity-directory/default/workload-identity/agentName-*`,
                    ],
                }),
                new iam.PolicyStatement({
                    sid: 'BedrockModelInvocation',
                    effect: iam.Effect.ALLOW,
                    actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
                    resources: [
                        `arn:aws:bedrock:*::foundation-model/*`,
                        `arn:aws:bedrock:${region}:${accountId}:*`,
                    ],
                }),
                
                new iam.PolicyStatement({
                    sid: 'AgentCoreMemoryAccess',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'bedrock-agentcore:CreateEvent',
                        'bedrock-agentcore:ListEvents',
                        'bedrock-agentcore:GetMemory',
                        'bedrock-agentcore:RetrieveMemoryRecords',
                    ],
                    resources: [
                        this.agentCoreMemory.attrMemoryArn,
                    ],
                }),
                
            ],
        });

        const runtimeRole = new iam.Role(this, `${props.appName}-AgentCoreRuntimeRole`, {
            assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
            description: 'IAM role for Bedrock AgentCore Runtime',
            inlinePolicies: {
                RuntimeAccessPolicy: runtimePolicy
            }
        });
        
        runtimeRole.node.addDependency(this.agentCoreMemory);
        

        this.agentCoreRuntime = new bedrockagentcore.CfnRuntime(this, `${props.appName}-AgentCoreRuntime`, {
            agentRuntimeArtifact: {
                containerConfiguration: {
                    containerUri: props.imageUri
                }
            },
            agentRuntimeName: "acagent_Agent",
            protocolConfiguration: "HTTP",
            networkConfiguration: {
                networkMode: "PUBLIC"
            },
            roleArn: runtimeRole.roleArn,
            environmentVariables: {
                "AWS_REGION": region,
                "GATEWAY_URL": this.agentCoreGateway.attrGatewayUrl,
                
                "BEDROCK_AGENTCORE_MEMORY_ID": this.agentCoreMemory.attrMemoryId,
                "COGNITO_CLIENT_ID": cognitoAppClient.userPoolClientId,
                "COGNITO_CLIENT_SECRET": cognitoAppClient.userPoolClientSecret.unsafeUnwrap(), // alternatives to consider: agentcore identity (no cdk constructs yet) or secrets manager
                "COGNITO_TOKEN_URL": cognitoTokenUrl,
                "COGNITO_SCOPE": `${cognitoResourceServer.userPoolResourceServerId}/${cognitoResourceServerScope.scopeName}`
            }
        });

        // DEFAULT endpoint always points to newest published version. Optionally, can use these versioned endpoints below
        // https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agent-runtime-versioning.html
        void new bedrockagentcore.CfnRuntimeEndpoint(this, `${props.appName}-AgentCoreRuntimeProdEndpoint`, {
            agentRuntimeId: this.agentCoreRuntime.attrAgentRuntimeId,
            agentRuntimeVersion: "1",
            name: "PROD"
        });

        void new bedrockagentcore.CfnRuntimeEndpoint(this, `${props.appName}-AgentCoreRuntimeDevEndpoint`, {
            agentRuntimeId: this.agentCoreRuntime.attrAgentRuntimeId,
            agentRuntimeVersion: "1",
            name: "DEV"
        });
    }
}