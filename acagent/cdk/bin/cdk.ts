#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CoreDeployProps } from '../lib/types';
import {
  DockerImageStack,
  AgentCoreStack,
  frontendStack,
} from '../lib/stacks';

const app = new cdk.App();

const deploymentProps: CoreDeployProps = {
  appName: "travelagent",
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  //env: { account: '123456789012', region: process.env. },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
}

const dockerImageStack = new DockerImageStack(app, `${deploymentProps.appName}-DockerImageStack`, deploymentProps);
const agentCoreStack = new AgentCoreStack(app, `${deploymentProps.appName}-AgentCoreStack`, {
  ...deploymentProps,
  imageUri: dockerImageStack.imageUri
});

new frontendStack(app, `${deploymentProps.appName}-MiddlewareStack`, deploymentProps)

agentCoreStack.addDependency(dockerImageStack);