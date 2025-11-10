import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
  CfnOutput
} from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  AttributeType,
  BillingMode,
  ProjectionType,
  Table
} from "aws-cdk-lib/aws-dynamodb";
import {
  Bucket,
  BucketEncryption,
  BlockPublicAccess,
  HttpMethods,
  EventType
} from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import {
  AccountRecovery,
  OAuthScope,
  UserPool,
  UserPoolClient
} from "aws-cdk-lib/aws-cognito";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";

export class GroupExpensesStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const table = new Table(this, "ExpensesTable", {
      partitionKey: { name: "PK", type: AttributeType.STRING },
      sortKey: { name: "SK", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.RETAIN
    });

    table.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: { name: "GSI1PK", type: AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: AttributeType.STRING },
      projectionType: ProjectionType.ALL
    });

    table.addGlobalSecondaryIndex({
      indexName: "GSI2",
      partitionKey: { name: "GSI2PK", type: AttributeType.STRING },
      sortKey: { name: "GSI2SK", type: AttributeType.STRING },
      projectionType: ProjectionType.ALL
    });

    table.addGlobalSecondaryIndex({
      indexName: "GSI3",
      partitionKey: { name: "GSI3PK", type: AttributeType.STRING },
      sortKey: { name: "GSI3SK", type: AttributeType.STRING },
      projectionType: ProjectionType.ALL
    });

    const receiptBucket = new Bucket(this, "ReceiptBucket", {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: false,
      enforceSSL: true,
      cors: [
        {
          allowedMethods: [HttpMethods.PUT, HttpMethods.HEAD, HttpMethods.GET],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3000
        }
      ],
      lifecycleRules: [
        {
          enabled: true,
          expiration: Duration.days(730),
          prefix: "trips/"
        }
      ],
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: false
    });

    const userPool = new UserPool(this, "UserPool", {
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false
      }
    });

    const userPoolClient = new UserPoolClient(this, "UserPoolClient", {
      userPool,
      authFlows: {
        userPassword: true,
        userSrp: true
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true
        },
        scopes: [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE]
      },
      generateSecret: false,
      preventUserExistenceErrors: true
    });

    const sharedEnvironment = {
      ALLOWED_ORIGIN: "http://localhost:5173"
    };

    const sharedFunctionProps = {
      runtime: Runtime.NODEJS_20_X,
      handler: "handler",
      timeout: Duration.seconds(15),
      memorySize: 256,
      bundling: {
        format: OutputFormat.ESM,
        target: "node20",
        sourcemap: true,
        externalModules: ["aws-sdk"],
        banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);"
      }
    };

    const httpLambda = new NodejsFunction(this, "HttpHandler", {
      ...sharedFunctionProps,
      entry: path.join(__dirname, "../../../services/api/src/handlers/http.ts"),
      logRetention: RetentionDays.ONE_WEEK,
      environment: {
        ...sharedEnvironment,
        TABLE_NAME: table.tableName,
        RECEIPT_BUCKET: receiptBucket.bucketName,
        SIGNED_URL_EXPIRY_SECONDS: "900",
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1"
      }
    });

    const textractLambda = new NodejsFunction(this, "TextractProcessor", {
      ...sharedFunctionProps,
      entry: path.join(
        __dirname,
        "../../../services/api/src/handlers/textractProcessor.ts"
      ),
      logRetention: RetentionDays.ONE_WEEK,
      environment: {
        ...sharedEnvironment,
        TABLE_NAME: table.tableName,
        RECEIPT_BUCKET: receiptBucket.bucketName,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1"
      }
    });

    table.grantReadWriteData(httpLambda);
    table.grantReadWriteData(textractLambda);

    receiptBucket.grantPut(httpLambda);
    receiptBucket.grantRead(httpLambda);
    receiptBucket.grantRead(textractLambda);

    textractLambda.addToRolePolicy(
      new PolicyStatement({
        actions: ["textract:AnalyzeExpense"],
        resources: ["*"]
      })
    );

    httpLambda.addToRolePolicy(
      new PolicyStatement({
        actions: ["textract:AnalyzeExpense"],
        resources: ["*"]
      })
    );

    receiptBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(textractLambda),
      { prefix: "trips/" }
    );

    const httpApi = new HttpApi(this, "GroupExpensesApi", {
      apiName: "GroupExpenses",
      corsPreflight: {
        allowCredentials: true,
        allowHeaders: ["*"],
        allowMethods: [CorsHttpMethod.ANY],
        allowOrigins: ["http://localhost:5173"],
        maxAge: Duration.hours(12)
      }
    });

    const httpIntegration = new HttpLambdaIntegration(
      "HttpHandlerIntegration",
      httpLambda
    );

    const authorizer = new HttpUserPoolAuthorizer("UserPoolAuthorizer", userPool, {
      userPoolClients: [userPoolClient]
    });

    httpApi.addRoutes({
      path: "/trips",
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: httpIntegration,
      authorizer
    });

    httpApi.addRoutes({
      path: "/trips/{proxy+}",
      methods: [HttpMethod.GET, HttpMethod.POST, HttpMethod.PATCH, HttpMethod.DELETE],
      integration: httpIntegration,
      authorizer
    });

    httpApi.addRoutes({
      path: "/users",
      methods: [HttpMethod.GET],
      integration: httpIntegration,
      authorizer
    });

    new CfnOutput(this, "ApiEndpoint", {
      value: httpApi.apiEndpoint
    });

    new CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId
    });

    new CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId
    });

    new CfnOutput(this, "ReceiptBucketName", {
      value: receiptBucket.bucketName
    });

    new CfnOutput(this, "DynamoTableName", {
      value: table.tableName
    });
  }
}
