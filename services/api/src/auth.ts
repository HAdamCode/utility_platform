import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ForbiddenError } from "./lib/errors.js";

export interface AuthContext {
  userId: string;
  email?: string;
  name?: string;
}

const USER_ID_CLAIMS = ["sub", "username", "cognito:username"];

type JwtAuthorizer = {
  jwt?: {
    claims?: Record<string, unknown>;
  };
} & Record<string, unknown>;

export const getAuthContext = (event: APIGatewayProxyEventV2): AuthContext => {
  const contextWithAuth = event.requestContext as {
    authorizer?: JwtAuthorizer;
  };
  const authorizer = contextWithAuth.authorizer;
  const claims =
    (authorizer?.jwt?.claims as Record<string, unknown> | undefined) ??
    (authorizer ?? {});

  const claimRecord = claims as Record<string, unknown>;

  const givenName =
    typeof claimRecord["given_name"] === "string"
      ? (claimRecord["given_name"] as string)
      : undefined;
  const familyName =
    typeof claimRecord["family_name"] === "string"
      ? (claimRecord["family_name"] as string)
      : undefined;
  const combinedName = [givenName, familyName].filter(Boolean).join(" ");
  const resolvedName =
    typeof claimRecord.name === "string"
      ? (claimRecord.name as string)
      : combinedName || undefined;

  for (const key of USER_ID_CLAIMS) {
    const value = claimRecord[key];
    if (typeof value === "string" && value.length) {
      return {
        userId: value,
        email:
          typeof claimRecord.email === "string"
            ? (claimRecord.email as string)
            : undefined,
        name: resolvedName
      };
    }
  }

  throw new ForbiddenError("Unauthenticated");
};
