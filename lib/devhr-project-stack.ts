import * as cdk from '@aws-cdk/core';
import { Bucket, EventType } from '@aws-cdk/aws-s3';
import { Function, Code, Runtime, LayerVersion } from '@aws-cdk/aws-lambda';
import { Table, AttributeType} from '@aws-cdk/aws-dynamodb';
import { Duration } from '@aws-cdk/core';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';
import { S3EventSource } from '@aws-cdk/aws-lambda-event-sources';

export class DevhrProjectStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const imageBucketName = 'cdk-rekn-imagebucket';
    const resizedBucketName = imageBucketName + '-resized'

    // =========================================================
    // Image Bucket
    // =========================================================
    const imageBucket = new Bucket(this, imageBucketName, {
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    new cdk.CfnOutput(this, 'imageBucket', { value: imageBucket.bucketName });

    // =========================================================
    // Thumbnail Image bucket
    // =========================================================
    const resizedBucket = new Bucket(this, resizedBucketName, {
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    new cdk.CfnOutput(this, 'resizedBucket', { value: resizedBucket.bucketName });

    const rekLambdaLayer = new LayerVersion(this, 'rekLambdaLayer', {
      code: Code.fromAsset('reklayer'),
      compatibleRuntimes: [Runtime.PYTHON_3_7],
      license: 'Apache-2.0',
      description: 'A Lambda Layer to enable to PIL library in Rekognition Lambda'
    });

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
      layers: [rekLambdaLayer],
      environment: {
        'TABLE': table.tableName,
        'BUCKET': imageBucket.bucketName,
        'THUMBBUCKET': resizedBucket.bucketName
      }
    });

    imageBucket.grantRead(rekFn);
    resizedBucket.grantPut(rekFn);
    table.grantWriteData(rekFn);

    const serviceFn = new Function(this, 'serviceFunction', {
      code: Code.fromAsset('servicelambda'),
      runtime: Runtime.PYTHON_3_7,
      handler: 'index.handler',
      environment: {
        'TABLE': table.tableName,
        'BUCKET': imageBucket.bucketName,
        'RESIZEDBUCKET': resizedBucket.bucketName
      }
    });

    imageBucket.grantWrite(serviceFn);
    resizedBucket.grantWrite(serviceFn);
    table.grantReadWriteData(serviceFn);

    rekFn.addEventSource(new S3EventSource(imageBucket, { events: [EventType.OBJECT_CREATED] }));

    rekFn.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['rekognition:DetectLabels'],
      resources: ['*']
    }));
  }
}
