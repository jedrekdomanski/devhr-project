import * as cdk from '@aws-cdk/core';
import { Bucket, EventType } from '@aws-cdk/aws-s3';
import { Function, Code, Runtime } from '@aws-cdk/aws-lambda';
import { Table, AttributeType} from '@aws-cdk/aws-dynamodb';
import { Duration } from '@aws-cdk/core';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';
import { S3EventSource } from '@aws-cdk/aws-lambda-event-sources';

// import * as sqs from 'aws-cdk-lib/aws-sqs';

const imageBucketName = 'cdk-rekn-imagebucket';

export class DevhrProjectStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // =========================================================
    // Image Bucket
    // =========================================================
    const imageBucket = new Bucket(this, 'imageBucketName');
    new cdk.CfnOutput(this, 'imageBucket', { value: imageBucket.bucketName });

    // =========================================================
    // Amazon DynamoDB table for storing image labels
    // =========================================================
    const table = new Table(this, 'ImageLabels', {
      partitionKey: { name: 'image', type: AttributeType.STRING }
    });
    new cdk.CfnOutput(this, 'ddbTable', { value: table.tableName });

    // =========================================================
    // AWS Lambda Function; compute for serverless microservice
    // =========================================================
    const rekFn = new Function(this, 'rekognitionFunction', {
      code: Code.fromAsset('rekognitionlambda'),
      runtime: Runtime.PYTHON_3_7,
      handler: 'index.handler',
      timeout: Duration.seconds(30),
      memorySize: 1024,
      environment: {
        'TABLE': table.tableName,
        'BUCKET': imageBucket.bucketName
      }
    });

    rekFn.addEventSource(new S3EventSource(imageBucket, { events: [EventType.OBJECT_CREATED] }));
    imageBucket.grantRead(rekFn);
    table.grantWriteData(rekFn);
    rekFn.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['rekognition:DetectLabels'],
      resources: ['*']
    }));
  }
}
