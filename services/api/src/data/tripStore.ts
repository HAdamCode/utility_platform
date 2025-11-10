import {
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "./dynamo.js";
import { loadConfig } from "../config.js";
import { Trip, TripMember, Expense, Receipt, Settlement } from "../types.js";
import { NotFoundError } from "../lib/errors.js";

const keys = {
  tripPk: (tripId: string) => `TRIP#${tripId}`,
  tripSkMeta: "METADATA",
  memberSk: (memberId: string) => `MEMBER#${memberId}`,
  expenseSk: (expenseId: string) => `EXPENSE#${expenseId}`,
  receiptSk: (receiptId: string) => `RECEIPT#${receiptId}`,
  settlementSk: (settlementId: string) => `SETTLEMENT#${settlementId}`
};

type TripEntity = Trip & {
  entityType: "Trip";
  PK: string;
  SK: string;
};

type MemberEntity = TripMember & {
  entityType: "TripMember";
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  tripName: string;
  ownerId: string;
  tripStartDate?: string;
  tripEndDate?: string;
  currency: string;
  tripCreatedAt: string;
  tripUpdatedAt: string;
};

type ExpenseEntity = Expense & {
  entityType: "Expense";
  PK: string;
  SK: string;
};

type ReceiptEntity = Receipt & {
  entityType: "Receipt";
  PK: string;
  SK: string;
};

type SettlementEntity = Settlement & {
  entityType: "Settlement";
  PK: string;
  SK: string;
};

const toTrip = (item: TripEntity): Trip => ({
  tripId: item.tripId,
  ownerId: item.ownerId,
  name: item.name,
  startDate: item.startDate,
  endDate: item.endDate,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  currency: item.currency
});

export interface TripDetails {
  trip: Trip;
  members: TripMember[];
  expenses: Expense[];
  receipts: Receipt[];
  settlements: Settlement[];
}

export class TripStore {
  private readonly tableName: string;
  private readonly docClient = getDocumentClient();

  constructor() {
    const config = loadConfig();
    this.tableName = config.tableName;
  }

  async createTrip(
    trip: Trip,
    ownerMember: TripMember
  ): Promise<void> {
    const tripItem: TripEntity = {
      entityType: "Trip",
      PK: keys.tripPk(trip.tripId),
      SK: keys.tripSkMeta,
      ...trip
    };

    const memberItem: MemberEntity = {
      entityType: "TripMember",
      PK: keys.tripPk(trip.tripId),
      SK: keys.memberSk(ownerMember.memberId),
      GSI1PK: `MEMBER#${ownerMember.memberId}`,
      GSI1SK: `TRIP#${trip.tripId}`,
      tripName: trip.name,
      ownerId: trip.ownerId,
      tripStartDate: trip.startDate,
      tripEndDate: trip.endDate,
      currency: trip.currency,
      tripCreatedAt: trip.createdAt,
      tripUpdatedAt: trip.updatedAt,
      ...ownerMember
    };

    await this.docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: this.tableName, Item: tripItem } },
          { Put: { TableName: this.tableName, Item: memberItem } }
        ]
      })
    );
  }

  async getTrip(tripId: string): Promise<Trip> {
    const { Item } = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: keys.tripPk(tripId),
          SK: keys.tripSkMeta
        }
      })
    );

    if (!Item) {
      throw new NotFoundError(`Trip ${tripId} not found`);
    }

    return toTrip(Item as TripEntity);
  }

  async listTripsForMember(memberId: string): Promise<Trip[]> {
    const { Items } = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :member",
        ExpressionAttributeValues: {
          ":member": `MEMBER#${memberId}`
        }
      })
    );

    if (!Items?.length) {
      return [];
    }

    // Items already contain trip summary details.
    const trips: Trip[] = Items.map((item) => ({
      tripId: item.tripId,
      ownerId: item.ownerId,
      name: item.tripName ?? item.name,
      startDate: item.startDate,
      endDate: item.endDate,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      currency: item.currency
    }));

    return trips;
  }

  async getTripDetails(tripId: string): Promise<TripDetails> {
    const { Items } = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": keys.tripPk(tripId)
        }
      })
    );

    if (!Items?.length) {
      throw new NotFoundError(`Trip ${tripId} not found`);
    }

    const tripRecord = Items.find((item) => item.SK === keys.tripSkMeta);
    if (!tripRecord) {
      throw new NotFoundError(`Trip ${tripId} malformed`);
    }

    const trip = toTrip(tripRecord as TripEntity);
    const members: TripMember[] = Items.filter(
      (item) => item.entityType === "TripMember"
    ).map((item) => ({
      tripId,
      memberId: item.memberId,
      displayName: item.displayName,
      email: item.email,
      addedBy: item.addedBy,
      createdAt: item.createdAt
    }));

    const expenses: Expense[] = Items.filter(
      (item) => item.entityType === "Expense"
    ).map((item) => ({
      tripId,
      expenseId: item.expenseId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      description: item.description,
      vendor: item.vendor,
      category: item.category,
      total: item.total,
      currency: item.currency,
      tax: item.tax,
      tip: item.tip,
      paidByMemberId: item.paidByMemberId,
      sharedWithMemberIds: item.sharedWithMemberIds,
      allocations: item.allocations,
      receiptId: item.receiptId,
      receiptPreviewUrl: item.receiptPreviewUrl
    }));

    const receipts: Receipt[] = Items.filter(
      (item) => item.entityType === "Receipt"
    ).map((item) => ({
      tripId,
      receiptId: item.receiptId,
      storageKey: item.storageKey,
      uploadUrl: item.uploadUrl,
      fileName: item.fileName,
      status: item.status,
      extractedData: item.extractedData,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));

    const settlements: Settlement[] = Items.filter(
      (item) => item.entityType === "Settlement"
    ).map((item) => ({
      tripId,
      settlementId: item.settlementId,
      fromMemberId: item.fromMemberId,
      toMemberId: item.toMemberId,
      amount: item.amount,
      currency: item.currency,
      note: item.note,
      createdAt: item.createdAt,
      createdBy: item.createdBy,
      confirmedAt: item.confirmedAt
    }));

    return {
      trip,
      members,
      expenses,
      receipts,
      settlements
    };
  }

  async addMembers(
    trip: Trip,
    members: TripMember[]
  ): Promise<void> {
    if (!members.length) return;

    const transactItems = members.map((member) => ({
      Put: {
        TableName: this.tableName,
        Item: <MemberEntity>{
          entityType: "TripMember",
          PK: keys.tripPk(member.tripId),
          SK: keys.memberSk(member.memberId),
          GSI1PK: `MEMBER#${member.memberId}`,
          GSI1SK: `TRIP#${trip.tripId}`,
          tripName: trip.name,
          ownerId: trip.ownerId,
          tripStartDate: trip.startDate,
          tripEndDate: trip.endDate,
          currency: trip.currency,
          tripCreatedAt: trip.createdAt,
          tripUpdatedAt: trip.updatedAt,
          ...member
        },
        ConditionExpression: "attribute_not_exists(PK)"
      }
    }));

    // DynamoDB limits to 25 items per transaction.
    const chunkSize = 25;
    for (let i = 0; i < transactItems.length; i += chunkSize) {
      const chunk = transactItems.slice(i, i + chunkSize);
      await this.docClient.send(
        new TransactWriteCommand({
          TransactItems: chunk
        })
      );
    }
  }

  async deleteMember(tripId: string, memberId: string): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: keys.tripPk(tripId),
          SK: keys.memberSk(memberId)
        }
      })
    );
  }

  async saveExpense(expense: Expense): Promise<void> {
    const item: ExpenseEntity = {
      entityType: "Expense",
      PK: keys.tripPk(expense.tripId),
      SK: keys.expenseSk(expense.expenseId),
      ...expense
    };
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item
      })
    );
  }

  async deleteExpense(tripId: string, expenseId: string): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: keys.tripPk(tripId),
          SK: keys.expenseSk(expenseId)
        }
      })
    );
  }

  async saveReceipt(receipt: Receipt): Promise<void> {
    const item: ReceiptEntity = {
      entityType: "Receipt",
      PK: keys.tripPk(receipt.tripId),
      SK: keys.receiptSk(receipt.receiptId),
      ...receipt
    };
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item
      })
    );
  }

  async updateReceiptExtraction(
    tripId: string,
    receiptId: string,
    updates: Partial<Pick<Receipt, "status" | "extractedData" | "updatedAt">>
  ): Promise<void> {
    const updateExpressions: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    let index = 0;

    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      names[attrName] = key;
      values[attrValue] = value;
      index += 1;
    }

    if (!updateExpressions.length) return;

    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: keys.tripPk(tripId),
          SK: keys.receiptSk(receiptId)
        },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values
      })
    );
  }

  async saveSettlement(settlement: Settlement): Promise<void> {
    const item: SettlementEntity = {
      entityType: "Settlement",
      PK: keys.tripPk(settlement.tripId),
      SK: keys.settlementSk(settlement.settlementId),
      ...settlement
    };
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item
      })
    );
  }

  async deleteSettlement(tripId: string, settlementId: string): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: keys.tripPk(tripId),
          SK: keys.settlementSk(settlementId)
        }
      })
    );
  }

  async markSettlementConfirmation(
    tripId: string,
    settlementId: string,
    confirmedAt?: string
  ): Promise<void> {
    if (confirmedAt) {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            PK: keys.tripPk(tripId),
            SK: keys.settlementSk(settlementId)
          },
          UpdateExpression: "SET confirmedAt = :confirmedAt",
          ExpressionAttributeValues: {
            ":confirmedAt": confirmedAt
          }
        })
      );
    } else {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            PK: keys.tripPk(tripId),
            SK: keys.settlementSk(settlementId)
          },
          UpdateExpression: "REMOVE confirmedAt"
        })
      );
    }
  }

  async batchGetTrips(tripIds: string[]): Promise<Trip[]> {
    if (!tripIds.length) return [];
    const keysInput = tripIds.map((tripId) => ({
      PK: keys.tripPk(tripId),
      SK: keys.tripSkMeta
    }));

    const { Responses } = await this.docClient.send(
      new BatchGetCommand({
        RequestItems: {
          [this.tableName]: {
            Keys: keysInput
          }
        }
      })
    );

    const items = Responses?.[this.tableName] ?? [];
    return items.map((item) => toTrip(item as TripEntity));
  }

  async updateExpenseAllocations(
    tripId: string,
    expenseId: string,
    updates: Partial<Pick<Expense, "allocations" | "sharedWithMemberIds" | "tax" | "tip" | "total" | "updatedAt">>
  ): Promise<void> {
    const updateExpressions: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    let index = 0;

    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      names[attrName] = key;
      values[attrValue] = value;
      index += 1;
    }

    if (!updateExpressions.length) return;

    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: keys.tripPk(tripId),
          SK: keys.expenseSk(expenseId)
        },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values
      })
    );
  }
}
