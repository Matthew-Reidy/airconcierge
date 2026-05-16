import * as cdk from 'aws-cdk-lib/core'

//interface contract for core deployment cdk properties
export interface CoreDeployProps extends cdk.StackProps {
    appName: string
}