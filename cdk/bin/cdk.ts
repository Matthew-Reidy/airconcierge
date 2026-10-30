#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { AgentStack, BackendStack, FrontendStack } from '../lib/stacks';

const app = new cdk.App();

const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

new FrontendStack(app, 'AirConciergeFrontend', { env });
const agent = new AgentStack(app, 'AirConciergeAgent', { env });
new BackendStack(app, 'AirConciergeBackend', {
  env,
  memoryId: agent.memory.attrMemoryId,
  memoryArn: agent.memory.attrMemoryArn,
});
