import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk/aws-s3';
import * as lambda from 'aws-cdk/aws-lambda';
import * as dynamodb from 'aws-cdk/aws-dynamodb';
import { Duration } from 'aws-cdk/core';
import * as iam from 'aws-cdk/aws-iam';
import * as event_sources from 'aws-cdk/aws-lambda-event-sources';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

const imageBucketName = 'cdk-rekn-imagebucket';

export class DevhrProjectStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // =========================================================
    // Image Bucket
    // =========================================================
    const imageBucket = new s3.Bucket(this, 'imageBucketName')
    new cdk.CfnOutput(this, 'imageBucket', { value: imageBucket.bucketName });

    // =========================================================
    // Amazon DynamoDB table for storing image labels
    // =========================================================
    const table = new.dynamodb.Table(this, 'ImageLabels', {
      partitionKey: { name: 'image', type: dynamodbAttributeType.STRING }
    });
    new cdk.CfnOutput(this, 'ddbTable', { value: table. })

    // =========================================================
    // AWS Lambda Function; compute for serverless microservice
    // =========================================================
    const rekFn = new.lambda.Function(this, 'rekognitionFunction', {
      code: lambda.Code.fromAsset('rekognitionlambda'),
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'index.handler',
      timeout: Duration.seconds(30),
      memorySize: 1024,
      environment: {
        'TABLE': table.tableName,
        'BUCKET': imageBucket.bucketName
      }
    });
    rekFn.addEventSource(new event_sources.S3EventSource(imageBucket, { events: [S3.EventType.OBJECT_CREATED]}))
    imageBucket.grantRead(rekFn);
    table.grantWriteData(rekFn);
    rekFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['rekognition:DetectLabels'],
      resources: ['*']
    }));
  }
}
