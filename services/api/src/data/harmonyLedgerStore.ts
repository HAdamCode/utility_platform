import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "./dynamo.js";
import { loadConfig } from "../config.js";
import type {
  HarmonyLedgerAccessRecord,
  HarmonyLedgerEntry,
  HarmonyLedgerGroup,
  HarmonyLedgerTransfer
} from "../types.js";

const ACCESS_PK = "HARMONY_LEDGER#ACCESS";
const ACCESS_SK = (accessId: string) => `ACCESS#${accessId}`;
const ENTRIES_PK = "HARMONY_LEDGER#ENTRY";
const ENTRY_SK = (recordedAt: string, entryId: string) =>
  `ENTRY#${recordedAt}#${entryId}`;
const GROUP_PK = "HARMONY_LEDGER#GROUP";
const GROUP_SK = (groupId: string) => `GROUP#${groupId}`;
const TRANSFER_PK = "HARMONY_LEDGER#TRANSFER";
const TRANSFER_SK = (createdAt: string, transferId: string) =>
  `TRANSFER#${createdAt}#${transferId}`;

type AccessEntity = HarmonyLedgerAccessRecord & {
  entityType: "HarmonyLedgerAccess";
  PK: string;
  SK: string;
  normalizedEmail?: string;
  GSI1PK?: string;
  GSI1SK?: string;
  GSI2PK?: string;
  GSI2SK?: string;
};

type LedgerEntryEntity = HarmonyLedgerEntry & {
  entityType: "HarmonyLedgerEntry";
  PK: string;
  SK: string;
};

type GroupEntity = HarmonyLedgerGroup & {
  entityType: "HarmonyLedgerGroup";
  PK: string;
  SK: string;
};

type TransferEntity = HarmonyLedgerTransfer & {
  entityType: "HarmonyLedgerTransfer";
  PK: string;
  SK: string;
};

const mapEntry = (item: Record<string, unknown>): HarmonyLedgerEntry => ({
  entryId: item.entryId as string,
  type: item.type as HarmonyLedgerEntry["type"],
  amount: Number(item.amount),
  currency: item.currency as string,
  description: (item.description as string) || undefined,
  source: (item.source as string) || undefined,
  category: (item.category as string) || undefined,
  notes: (item.notes as string) || undefined,
  memberName: (item.memberName as string) || undefined,
  groupId: (item.groupId as string) || undefined,
  groupName: (item.groupName as string) || undefined,
  recordedAt: item.recordedAt as string,
  recordedBy: item.recordedBy as string,
  recordedByName: (item.recordedByName as string) || undefined
});

export interface CreateAccessRecordInput {
  accessId: string;
  userId?: string;
  email?: string;
  normalizedEmail?: string;
  displayName?: string;
  isAdmin: boolean;
  addedAt: string;
  addedBy: string;
  addedByName?: string;
}

export interface UpdateAccessRecordInput {
  displayName?: string;
  email?: string;
  normalizedEmail?: string;
  userId?: string;
}

const mapAccess = (item: Record<string, unknown>): HarmonyLedgerAccessRecord => ({
  accessId: item.accessId as string,
  userId: (item.userId as string) || undefined,
  email: (item.email as string) || undefined,
  displayName: (item.displayName as string) || undefined,
  isAdmin: Boolean(item.isAdmin),
  addedAt: item.addedAt as string,
  addedBy: item.addedBy as string,
  addedByName: (item.addedByName as string) || undefined
});

export class HarmonyLedgerStore {
  private readonly tableName: string;
  private readonly docClient = getDocumentClient();

  constructor() {
    this.tableName = loadConfig().tableName;
  }

  async listAccessRecords(): Promise<HarmonyLedgerAccessRecord[]> {
    const { Items } = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": ACCESS_PK
        }
      })
    );

    if (!Items?.length) {
      return [];
    }

    return Items.map((item) => mapAccess(item as Record<string, unknown>));
  }

  async findAccessByUserId(
    userId: string
  ): Promise<HarmonyLedgerAccessRecord | null> {
    const { Items } = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `HARMONY_LEDGER#USER#${userId}`
        },
        Limit: 1
      })
    );

    if (!Items?.length) {
      return null;
    }

    return mapAccess(Items[0] as Record<string, unknown>);
  }

  async findAccessByEmail(
    normalizedEmail: string
  ): Promise<HarmonyLedgerAccessRecord | null> {
    const { Items } = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI2",
        KeyConditionExpression:
          "GSI2PK = :pk AND begins_with(GSI2SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": "HARMONY_LEDGER#EMAIL",
          ":sk": `EMAIL#${normalizedEmail}`
        },
        Limit: 1
      })
    );

    if (!Items?.length) {
      return null;
    }

    return mapAccess(Items[0] as Record<string, unknown>);
  }

  async createAccessRecord(
    record: CreateAccessRecordInput
  ): Promise<HarmonyLedgerAccessRecord> {
    const entity: AccessEntity = {
      entityType: "HarmonyLedgerAccess",
      PK: ACCESS_PK,
      SK: ACCESS_SK(record.accessId),
      accessId: record.accessId,
      userId: record.userId,
      email: record.email,
      normalizedEmail: record.normalizedEmail,
      displayName: record.displayName,
      isAdmin: record.isAdmin,
      addedAt: record.addedAt,
      addedBy: record.addedBy,
      addedByName: record.addedByName,
      ...(record.userId
        ? {
            GSI1PK: `HARMONY_LEDGER#USER#${record.userId}`,
            GSI1SK: ACCESS_SK(record.accessId)
          }
        : {}),
      ...(record.normalizedEmail
        ? {
            GSI2PK: "HARMONY_LEDGER#EMAIL",
            GSI2SK: `EMAIL#${record.normalizedEmail}#${record.accessId}`
          }
        : {})
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: entity,
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
      })
    );

    return {
      accessId: entity.accessId,
      userId: entity.userId,
      email: entity.email,
      displayName: entity.displayName,
      isAdmin: entity.isAdmin,
      addedAt: entity.addedAt,
      addedBy: entity.addedBy,
      addedByName: entity.addedByName
    } satisfies HarmonyLedgerAccessRecord;
  }

  async attachUserToAccess(accessId: string, userId: string): Promise<void> {
    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: ACCESS_PK,
          SK: ACCESS_SK(accessId)
        },
        UpdateExpression:
          "SET userId = :userId, GSI1PK = :gsi1pk, GSI1SK = :gsi1sk",
        ExpressionAttributeValues: {
          ":userId": userId,
          ":gsi1pk": `HARMONY_LEDGER#USER#${userId}`,
          ":gsi1sk": ACCESS_SK(accessId)
        }
      })
    );
  }

  async deleteAccessRecord(accessId: string): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: ACCESS_PK,
          SK: ACCESS_SK(accessId)
        }
      })
    );
  }

  async listEntries(): Promise<HarmonyLedgerEntry[]> {
    const { Items } = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": ENTRIES_PK
        },
        ScanIndexForward: false
      })
    );

    if (!Items?.length) {
      return [];
    }

    return Items.map((item) => mapEntry(item as Record<string, unknown>));
  }

  async createEntry(entry: HarmonyLedgerEntry): Promise<HarmonyLedgerEntry> {
    const entity: LedgerEntryEntity = {
      entityType: "HarmonyLedgerEntry",
      PK: ENTRIES_PK,
      SK: ENTRY_SK(entry.recordedAt, entry.entryId),
      ...entry
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: entity,
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
      })
    );

    return entry;
  }

  async listTransfers(): Promise<HarmonyLedgerTransfer[]> {
    const { Items } = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": TRANSFER_PK
        },
        ScanIndexForward: false
      })
    );

    if (!Items?.length) {
      return [];
    }

    return Items.map((item) => item as TransferEntity);
  }

  async createTransfer(transfer: HarmonyLedgerTransfer): Promise<void> {
    const entity: TransferEntity = {
      entityType: "HarmonyLedgerTransfer",
      PK: TRANSFER_PK,
      SK: TRANSFER_SK(transfer.createdAt, transfer.transferId),
      ...transfer
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: entity,
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
      })
    );
  }

  async getEntry(
    entryId: string,
    recordedAt: string
  ): Promise<HarmonyLedgerEntry | null> {
    const { Item } = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: ENTRIES_PK,
          SK: ENTRY_SK(recordedAt, entryId)
        }
      })
    );

    if (!Item) {
      return null;
    }

    return mapEntry(Item as Record<string, unknown>);
  }

  async updateEntryGroup(
    entryId: string,
    recordedAt: string,
    group?: { groupId: string; groupName: string }
  ): Promise<HarmonyLedgerEntry> {
    const key = {
      PK: ENTRIES_PK,
      SK: ENTRY_SK(recordedAt, entryId)
    };

    const response = await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: key,
        ...(group
          ? {
              UpdateExpression: "SET groupId = :groupId, groupName = :groupName",
              ExpressionAttributeValues: {
                ":groupId": group.groupId,
                ":groupName": group.groupName
              }
            }
          : {
              UpdateExpression: "REMOVE groupId, groupName"
            }),
        ReturnValues: "ALL_NEW"
      })
    );

    return mapEntry(response.Attributes as Record<string, unknown>);
  }

  async deleteEntry(entryId: string, recordedAt: string): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: ENTRIES_PK,
          SK: ENTRY_SK(recordedAt, entryId)
        }
      })
    );
  }

  async updateAccessMetadata(
    accessId: string,
    updates: UpdateAccessRecordInput
  ): Promise<void> {
    const expressions: string[] = [];
    const values: Record<string, unknown> = {};

    if (updates.displayName !== undefined) {
      expressions.push("displayName = :displayName");
      values[":displayName"] = updates.displayName;
    }
    if (updates.email !== undefined) {
      expressions.push("email = :email");
      values[":email"] = updates.email;
    }
    if (updates.normalizedEmail !== undefined) {
      expressions.push("normalizedEmail = :normalizedEmail");
      values[":normalizedEmail"] = updates.normalizedEmail;
      expressions.push("GSI2PK = :gsi2pk");
      values[":gsi2pk"] = "HARMONY_LEDGER#EMAIL";
      expressions.push("GSI2SK = :gsi2sk");
      values[":gsi2sk"] = `EMAIL#${updates.normalizedEmail}#${accessId}`;
    }
    if (updates.userId !== undefined) {
      expressions.push("userId = :userId");
      values[":userId"] = updates.userId;
      expressions.push("GSI1PK = :gsi1pk");
      values[":gsi1pk"] = `HARMONY_LEDGER#USER#${updates.userId}`;
      expressions.push("GSI1SK = :gsi1sk");
      values[":gsi1sk"] = ACCESS_SK(accessId);
    }

    if (!expressions.length) {
      return;
    }

    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: ACCESS_PK,
          SK: ACCESS_SK(accessId)
        },
        UpdateExpression: `SET ${expressions.join(", ")}`,
        ExpressionAttributeValues: values
      })
    );
  }

  async listGroups(): Promise<HarmonyLedgerGroup[]> {
    const { Items } = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": GROUP_PK
        }
      })
    );

    if (!Items?.length) {
      return [];
    }

    return Items.map((item) => {
      const group = item as GroupEntity;
      return {
        groupId: group.groupId,
        name: group.name,
        isActive: group.isActive,
        createdAt: group.createdAt,
        createdBy: group.createdBy
      } satisfies HarmonyLedgerGroup;
    });
  }

  async getGroup(groupId: string): Promise<HarmonyLedgerGroup | null> {
    const { Item } = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: GROUP_PK,
          SK: GROUP_SK(groupId)
        }
      })
    );

    if (!Item) {
      return null;
    }

    const entity = Item as GroupEntity;
    return {
      groupId: entity.groupId,
      name: entity.name,
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      createdBy: entity.createdBy
    } satisfies HarmonyLedgerGroup;
  }

  async createGroup(group: HarmonyLedgerGroup): Promise<void> {
    const entity: GroupEntity = {
      entityType: "HarmonyLedgerGroup",
      PK: GROUP_PK,
      SK: GROUP_SK(group.groupId),
      ...group
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: entity,
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
      })
    );
  }

  async deleteTransfer(transferId: string, createdAt: string): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: TRANSFER_PK,
          SK: TRANSFER_SK(createdAt, transferId)
        }
      })
    );
  }
}
