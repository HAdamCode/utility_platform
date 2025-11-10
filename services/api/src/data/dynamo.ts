import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TranslateConfig
} from "@aws-sdk/lib-dynamodb";

let docClient: DynamoDBDocumentClient | null = null;

export const getDocumentClient = (): DynamoDBDocumentClient => {
  if (!docClient) {
    const translateConfig: TranslateConfig = {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true
      }
    };
    docClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        region:
          process.env.AWS_REGION ||
          process.env.AWS_DEFAULT_REGION ||
          process.env.REGION ||
          "us-east-1"
      }),
      translateConfig
    );
  }
  return docClient;
};
