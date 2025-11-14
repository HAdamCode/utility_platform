import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { TripService } from "../services/tripService.js";
import { UserService } from "../services/userService.js";
import { HarmonyLedgerService } from "../services/harmonyLedgerService.js";
import { getAuthContext } from "../auth.js";
import {
  handleError,
  json,
  parseBody,
  preflightResponse,
  corsHeaders
} from "../lib/http.js";
import { ValidationError } from "../lib/errors.js";

const tripService = new TripService();
const userService = new UserService();
const harmonyLedgerService = new HarmonyLedgerService();
const ok = (body: unknown, origin: string): APIGatewayProxyResultV2 =>
  json(200, body, origin);
const created = (body: unknown, origin: string): APIGatewayProxyResultV2 =>
  json(201, body, origin);
const noContent = (origin: string): APIGatewayProxyResultV2 => ({
  statusCode: 204,
  headers: corsHeaders(origin)
});

const parseAllowedOrigins = (): string[] => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(",")
      .map(origin => origin.trim())
      .filter(Boolean);
  }

  if (process.env.ALLOWED_ORIGIN) {
    return [process.env.ALLOWED_ORIGIN];
  }

  return ["http://localhost:5173"];
};

const allowedOrigins = parseAllowedOrigins();
const DEFAULT_ORIGIN = allowedOrigins[0];

const getOrigin = (event: APIGatewayProxyEventV2): string => {
  const requestOrigin = event.headers?.origin ?? event.headers?.Origin;
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }
  return DEFAULT_ORIGIN;
};

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const origin = getOrigin(event);
  try {
    if (event.requestContext.http.method === "OPTIONS") {
      return preflightResponse(origin);
    }

    const path = event.requestContext.http.path ?? event.rawPath;
    const method = event.requestContext.http.method;
    const auth = getAuthContext(event);

    if (method === "GET" && path === "/users") {
      const users = await userService.searchUsers(
        event.queryStringParameters ?? {},
        auth
      );
      return ok({ users }, origin);
    }

    if (path === "/harmony-ledger/access" && method === "GET") {
      const response = await harmonyLedgerService.getAccessOverview(auth);
      return ok(response, origin);
    }

    if (path === "/harmony-ledger/access" && method === "POST") {
      const body = parseBody(event);
      const record = await harmonyLedgerService.addAccess(body, auth);
      return created(record, origin);
    }

    const harmonyAccessMatch = path.match(/^\/harmony-ledger\/access\/([^/]+)$/);
    if (harmonyAccessMatch && method === "DELETE") {
      await harmonyLedgerService.removeAccess(harmonyAccessMatch[1], auth);
      return noContent(origin);
    }

    if (path === "/harmony-ledger/groups" && method === "GET") {
      const groups = await harmonyLedgerService.listGroups(auth);
      return ok({ groups }, origin);
    }

    if (path === "/harmony-ledger/entries" && method === "GET") {
      const data = await harmonyLedgerService.getEntries(auth);
      return ok(data, origin);
    }

    if (path === "/harmony-ledger/entries" && method === "POST") {
      const body = parseBody(event);
      const entry = await harmonyLedgerService.createEntry(body, auth);
      return created(entry, origin);
    }

    const harmonyEntryMatch = path.match(/^\/harmony-ledger\/entries\/([^/]+)$/);
    if (harmonyEntryMatch && method === "PATCH") {
      const entryId = decodeURIComponent(harmonyEntryMatch[1]);
      const body = parseBody(event);
      if (!body) {
        return handleError(new ValidationError("Request body required"), origin);
      }
      const entry = await harmonyLedgerService.updateEntryGroup(entryId, body, auth);
      return ok(entry, origin);
    }

    if (path === "/harmony-ledger/transfers" && method === "POST") {
      const body = parseBody(event);
      const transfer = await harmonyLedgerService.createTransfer(body, auth);
      return created(transfer, origin);
    }

    if (method === "GET" && path === "/trips") {
      const trips = await tripService.listTrips(auth);
      return ok({ trips }, origin);
    }

    if (method === "POST" && path === "/trips") {
      const body = parseBody(event);
      const trip = await tripService.createTrip(body, auth);
      return created(trip, origin);
    }

    const tripMatch = path.match(/^\/trips\/([^/]+)(?:\/(.*))?$/);
    if (tripMatch) {
      const tripId = decodeURIComponent(tripMatch[1]);
      const remainder = tripMatch[2] ? `/${tripMatch[2]}` : "";

      if (!remainder && method === "GET") {
        const summary = await tripService.getTripSummary(tripId, auth);
        return ok(summary, origin);
      }

      if (!remainder && method === "PATCH") {
        const body = parseBody(event);
        const trip = await tripService.updateTrip(tripId, body, auth);
        return ok(trip, origin);
      }

      if (remainder === "/members" && method === "POST") {
        const body = parseBody(event);
        const members = await tripService.addMembers(tripId, body, auth);
        return created({ members }, origin);
      }
      const memberMatch = remainder.match(/^\/members\/([^/]+)$/);
      if (memberMatch && method === "DELETE") {
        const memberId = decodeURIComponent(memberMatch[1]);
        await tripService.removeMember(tripId, memberId, auth);
        return noContent(origin);
      }

      if (remainder === "/expenses" && method === "POST") {
        const body = parseBody(event);
        const expense = await tripService.createExpense(tripId, body, auth);
        return created(expense, origin);
      }

      const expenseMatch = remainder.match(/^\/expenses\/([^/]+)$/);
      if (expenseMatch && method === "PATCH") {
        const expenseId = decodeURIComponent(expenseMatch[1]);
        const body = parseBody(event);
        await tripService.updateExpense(tripId, expenseId, body, auth);
        return noContent(origin);
      }
      if (expenseMatch && method === "DELETE") {
        const expenseId = decodeURIComponent(expenseMatch[1]);
        await tripService.deleteExpense(tripId, expenseId, auth);
        return noContent(origin);
      }

      if (remainder === "/receipts" && method === "POST") {
        const body = parseBody(event);
        const receipt = await tripService.createReceipt(tripId, body, auth);
        return created(receipt, origin);
      }

      if (remainder === "/receipts/analyze" && method === "POST") {
        const body = parseBody(event);
        const extraction = await tripService.analyzeReceiptLive(tripId, body, auth);
        return ok({ extraction }, origin);
      }

      const receiptMatch = remainder.match(/^\/receipts\/([^/]+)$/);
      if (receiptMatch && method === "GET") {
        const receiptId = decodeURIComponent(receiptMatch[1]);
        const url = await tripService.getReceiptDownloadUrl(tripId, receiptId, auth);
        return ok(url, origin);
      }

      if (remainder === "/settlements" && method === "POST") {
        const body = parseBody(event);
        const settlement = await tripService.recordSettlement(tripId, body, auth);
        return created(settlement, origin);
      }

      const settlementMatch = remainder.match(/^\/settlements\/([^/]+)$/);
      if (settlementMatch && method === "PATCH") {
        const settlementId = decodeURIComponent(settlementMatch[1]);
        const body = parseBody(event);
        await tripService.confirmSettlement(tripId, settlementId, body, auth);
        return noContent(origin);
      }
      if (settlementMatch && method === "DELETE") {
        const settlementId = decodeURIComponent(settlementMatch[1]);
        await tripService.deleteSettlement(tripId, settlementId, auth);
        return noContent(origin);
      }
    }

    return json(404, { message: "Not Found" }, origin);
  } catch (error) {
    return handleError(error, origin);
  }
};
