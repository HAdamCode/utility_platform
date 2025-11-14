import { nanoid } from "nanoid";
import { z } from "zod";
import type { AuthContext } from "../auth.js";
import { HarmonyLedgerStore } from "../data/harmonyLedgerStore.js";
import { UserStore } from "../data/userStore.js";
import {
  ForbiddenError,
  ValidationError
} from "../lib/errors.js";
import type {
  HarmonyLedgerAccessRecord,
  HarmonyLedgerEntry,
  HarmonyLedgerGroup,
  HarmonyLedgerTransfer,
  HarmonyLedgerUnallocatedSummary,
  UserProfile
} from "../types.js";

const DEFAULT_ADMIN_EMAILS = ["hunter.j.adam@gmail.com"].map((email) =>
  email.toLowerCase()
);
const ledgerEntryTypes = [
  "DONATION",
  "INCOME",
  "EXPENSE",
  "REIMBURSEMENT"
] as const;
const DEFAULT_GROUPS: Array<{ groupId: string; name: string }> = [
  { groupId: "highlyte", name: "Highlyte" },
  { groupId: "verse", name: "Verse" },
  { groupId: "golden-ratio", name: "Golden Ratio" },
  { groupId: "out-of-range", name: "Out of Range" },
  { groupId: "counterpoint", name: "Counterpoint" }
];

const entrySchema = z.object({
  type: z.enum(ledgerEntryTypes),
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  description: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
  memberName: z.string().min(1).optional(),
  groupId: z.string().min(1).optional()
});

const addAccessSchema = z
  .object({
    userId: z.string().min(1).optional(),
    email: z.string().email().optional(),
    displayName: z.string().min(1).optional(),
    isAdmin: z.boolean().optional()
  })
  .refine((value) => Boolean(value.userId || value.email), {
    message: "Provide a userId or email to grant access"
  });

const updateEntryGroupSchema = z.object({
  recordedAt: z.string().min(1),
  groupId: z.union([z.string().min(1), z.null()]).optional()
});

const transferSchema = z
  .object({
    fromGroupId: z.string().min(1).optional(),
    toGroupId: z.string().min(1).optional(),
    amount: z.number().positive(),
    currency: z.string().default("USD"),
    note: z.string().optional()
  })
  .refine((value) => (value.fromGroupId || value.toGroupId) && value.fromGroupId !== value.toGroupId, {
    message: "Provide different source and destination"
  });

const deleteTransferSchema = z.object({
  createdAt: z.string().min(1)
});

export interface HarmonyLedgerAccessResponse {
  allowed: boolean;
  isAdmin: boolean;
  members?: HarmonyLedgerAccessRecord[];
  currentAccessId?: string;
}

export interface HarmonyLedgerEntriesResponse {
  entries: HarmonyLedgerEntry[];
  totals: {
    donations: number;
    income: number;
    expenses: number;
    reimbursements: number;
    net: number;
  };
  groups: HarmonyLedgerGroup[];
  groupSummaries: HarmonyLedgerGroupSummary[];
  unallocated: HarmonyLedgerUnallocatedSummary;
  transfers: HarmonyLedgerTransfer[];
}

export interface HarmonyLedgerOverviewResponse {
  totals: HarmonyLedgerEntriesResponse["totals"];
  groups: HarmonyLedgerGroupSummary[];
  unallocated: HarmonyLedgerUnallocatedSummary;
  transfers: HarmonyLedgerTransfer[];
}

export interface HarmonyLedgerGroupSummary {
  groupId: string;
  name: string;
  donations: number;
  income: number;
  expenses: number;
  reimbursements: number;
  transfersIn: number;
  transfersOut: number;
  net: number;
}

const isoNow = () => new Date().toISOString();

const displayNameFromProfile = (profile: UserProfile): string =>
  profile.displayName ?? profile.email ?? profile.userId;

export class HarmonyLedgerService {
  private readonly store = new HarmonyLedgerStore();
  private readonly userStore = new UserStore();
  private bootstrapPromise: Promise<void> | null = null;
  private groupBootstrapPromise: Promise<void> | null = null;

  private normalizeEmail(email?: string | null): string | null {
    return email ? email.trim().toLowerCase() : null;
  }

  private async ensureDefaultAdminAccess(): Promise<void> {
    if (this.bootstrapPromise) {
      await this.bootstrapPromise;
      return;
    }

    this.bootstrapPromise = (async () => {
      for (const email of DEFAULT_ADMIN_EMAILS) {
        const existing = await this.store.findAccessByEmail(email);
        if (!existing) {
          await this.store.createAccessRecord({
            accessId: nanoid(12),
            email,
            normalizedEmail: email,
            displayName: "Harmony Admin",
            isAdmin: true,
            addedAt: isoNow(),
            addedBy: "system",
            addedByName: "System"
          });
        }
      }
    })();

    await this.bootstrapPromise;
    this.bootstrapPromise = null;
  }

  private async ensureDefaultGroups(): Promise<void> {
    if (this.groupBootstrapPromise) {
      await this.groupBootstrapPromise;
      return;
    }

    this.groupBootstrapPromise = (async () => {
      const existingGroups = await this.store.listGroups();
      const existingIds = new Set(existingGroups.map((group) => group.groupId));
      for (const group of DEFAULT_GROUPS) {
        if (!existingIds.has(group.groupId)) {
          const now = isoNow();
          await this.store.createGroup({
            groupId: group.groupId,
            name: group.name,
            isActive: true,
            createdAt: now,
            createdBy: "system"
          });
        }
      }
    })();

    await this.groupBootstrapPromise;
    this.groupBootstrapPromise = null;
  }

  private async resolveAccessForProfile(
    profile: UserProfile
  ): Promise<HarmonyLedgerAccessRecord | null> {
    await this.ensureDefaultAdminAccess();
    let access = await this.store.findAccessByUserId(profile.userId);
    if (access) {
      return access;
    }

    const normalizedEmail = this.normalizeEmail(profile.email);
    if (!normalizedEmail) {
      return null;
    }

    access = await this.store.findAccessByEmail(normalizedEmail);
    if (access && !access.userId) {
      await this.store.updateAccessMetadata(access.accessId, {
        userId: profile.userId
      });
      access = { ...access, userId: profile.userId };
    }
    return access;
  }

  private async requireAccess(auth: AuthContext): Promise<{
    profile: UserProfile;
    access: HarmonyLedgerAccessRecord;
  }> {
    const profile = await this.userStore.ensureUserProfile(auth);
    const access = await this.resolveAccessForProfile(profile);
    if (!access) {
      throw new ForbiddenError("You do not have access to Harmony Collective yet.");
    }
    return { profile, access };
  }

  private async requireAdmin(auth: AuthContext): Promise<{
    profile: UserProfile;
    access: HarmonyLedgerAccessRecord;
  }> {
    const context = await this.requireAccess(auth);
    if (!context.access.isAdmin) {
      throw new ForbiddenError("Only Harmony Collective admins can manage access.");
    }
    return context;
  }

  private computeTotals(
    entries: HarmonyLedgerEntry[],
    transfers: HarmonyLedgerTransfer[]
  ): {
    overall: HarmonyLedgerEntriesResponse["totals"];
    groupSummaries: HarmonyLedgerGroupSummary[];
    unallocated: HarmonyLedgerUnallocatedSummary;
  } {
    const totals = {
      donations: 0,
      income: 0,
      expenses: 0,
      reimbursements: 0,
      net: 0
    };
    const groupMap = new Map<string, HarmonyLedgerGroupSummary>();
    const unallocated = {
      donations: 0,
      income: 0,
      expenses: 0,
      reimbursements: 0,
      transfersIn: 0,
      transfersOut: 0,
      net: 0
    } satisfies HarmonyLedgerUnallocatedSummary;

    const ensureGroupBucket = (groupId?: string, groupName?: string) => {
      if (!groupId) {
        return unallocated;
      }
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          groupId,
          name: groupName ?? groupId,
          donations: 0,
          income: 0,
          expenses: 0,
          reimbursements: 0,
          transfersIn: 0,
          transfersOut: 0,
          net: 0
        });
      }
      return groupMap.get(groupId)!;
    };

    for (const entry of entries) {
      switch (entry.type) {
        case "DONATION":
          totals.donations += entry.amount;
          break;
        case "INCOME":
          totals.income += entry.amount;
          break;
        case "EXPENSE":
          totals.expenses += entry.amount;
          break;
        case "REIMBURSEMENT":
          totals.reimbursements += entry.amount;
          break;
      }

      const bucket = ensureGroupBucket(entry.groupId, entry.groupName);

      switch (entry.type) {
        case "DONATION":
          bucket.donations += entry.amount;
          break;
        case "INCOME":
          bucket.income += entry.amount;
          break;
        case "EXPENSE":
          bucket.expenses += entry.amount;
          break;
        case "REIMBURSEMENT":
          bucket.reimbursements += entry.amount;
          break;
      }
    }
    for (const transfer of transfers) {
      const sourceBucket = ensureGroupBucket(transfer.fromGroupId, transfer.fromGroupName);
      const targetBucket = ensureGroupBucket(transfer.toGroupId, transfer.toGroupName);
      sourceBucket.transfersOut += transfer.amount;
      targetBucket.transfersIn += transfer.amount;
    }

    totals.net = totals.donations + totals.income + totals.reimbursements - totals.expenses;
    unallocated.net =
      unallocated.donations +
      unallocated.income +
      unallocated.reimbursements +
      unallocated.transfersIn -
      (unallocated.expenses + unallocated.transfersOut);
    const groupSummaries = Array.from(groupMap.values()).map((summary) => ({
      ...summary,
      net:
        summary.donations +
        summary.income +
        summary.reimbursements +
        summary.transfersIn -
        (summary.expenses + summary.transfersOut)
    }));
    return { overall: totals, groupSummaries, unallocated };
  }

  async getEntries(auth: AuthContext): Promise<HarmonyLedgerEntriesResponse> {
    await this.requireAccess(auth);
    await this.ensureDefaultGroups();
    const [entries, groups, transfers] = await Promise.all([
      this.store.listEntries(),
      this.store.listGroups(),
      this.store.listTransfers()
    ]);
    const { overall, groupSummaries, unallocated } = this.computeTotals(entries, transfers);
    return {
      entries,
      totals: overall,
      groups,
      groupSummaries,
      unallocated,
      transfers
    };
  }

  async getOverview(auth: AuthContext): Promise<HarmonyLedgerOverviewResponse> {
    const data = await this.getEntries(auth);
    return {
      totals: data.totals,
      groups: data.groupSummaries,
      unallocated: data.unallocated,
      transfers: data.transfers
    };
  }

  async createEntry(
    body: unknown,
    auth: AuthContext
  ): Promise<HarmonyLedgerEntry> {
    const { profile } = await this.requireAccess(auth);
    const parsed = entrySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const payload = parsed.data;
    let groupName: string | undefined;
    if (payload.groupId) {
      await this.ensureDefaultGroups();
      const group = await this.store.getGroup(payload.groupId);
      if (!group) {
        throw new ValidationError("Unknown Harmony Collective group.");
      }
      groupName = group.name;
    }

    const entry: HarmonyLedgerEntry = {
      entryId: nanoid(12),
      type: payload.type,
      amount: payload.amount,
      currency: payload.currency,
      description: payload.description,
      source: payload.source,
      category: payload.category,
      notes: payload.notes,
      memberName: payload.memberName,
      groupId: payload.groupId,
      groupName,
      recordedAt: isoNow(),
      recordedBy: profile.userId,
      recordedByName: displayNameFromProfile(profile)
    };

    await this.store.createEntry(entry);
    return entry;
  }

  async updateEntryGroup(
    entryId: string,
    body: unknown,
    auth: AuthContext
  ): Promise<HarmonyLedgerEntry> {
    await this.requireAccess(auth);
    const parsed = updateEntryGroupSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const { recordedAt, groupId } = parsed.data;
    if (!recordedAt) {
      throw new ValidationError("recordedAt is required");
    }

    let groupDetails: { groupId: string; groupName: string } | undefined;
    if (groupId) {
      await this.ensureDefaultGroups();
      const group = await this.store.getGroup(groupId);
      if (!group) {
        throw new ValidationError("Unknown Harmony Collective group.");
      }
      groupDetails = { groupId: group.groupId, groupName: group.name };
    }

    return this.store.updateEntryGroup(entryId, recordedAt, groupDetails);
  }

  async deleteEntry(
    entryId: string,
    body: unknown,
    auth: AuthContext
  ): Promise<void> {
    await this.requireAccess(auth);
    const parsed = updateEntryGroupSchema.pick({ recordedAt: true }).safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    await this.store.deleteEntry(entryId, parsed.data.recordedAt);
  }

  async createTransfer(body: unknown, auth: AuthContext): Promise<HarmonyLedgerTransfer> {
    const { profile } = await this.requireAccess(auth);
    const parsed = transferSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const { fromGroupId, toGroupId, amount, currency, note } = parsed.data;

    if (!fromGroupId && !toGroupId) {
      throw new ValidationError("Provide at least one source or destination group.");
    }

    await this.ensureDefaultGroups();

    const fromGroup = fromGroupId ? await this.store.getGroup(fromGroupId) : null;
    if (fromGroupId && !fromGroup) {
      throw new ValidationError("Source group not found");
    }
    const toGroup = toGroupId ? await this.store.getGroup(toGroupId) : null;
    if (toGroupId && !toGroup) {
      throw new ValidationError("Destination group not found");
    }

    const transfer: HarmonyLedgerTransfer = {
      transferId: nanoid(12),
      amount,
      currency,
      fromGroupId: fromGroup?.groupId,
      fromGroupName: fromGroup?.name,
      toGroupId: toGroup?.groupId,
      toGroupName: toGroup?.name,
      note,
      createdAt: isoNow(),
      createdBy: profile.userId,
      createdByName: displayNameFromProfile(profile)
    };

    await this.store.createTransfer(transfer);
    return transfer;
  }

  async deleteTransfer(
    transferId: string,
    body: unknown,
    auth: AuthContext
  ): Promise<void> {
    await this.requireAccess(auth);
    const parsed = deleteTransferSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    await this.store.deleteTransfer(transferId, parsed.data.createdAt);
  }

  async getAccessOverview(auth: AuthContext): Promise<HarmonyLedgerAccessResponse> {
    const profile = await this.userStore.ensureUserProfile(auth);
    const access = await this.resolveAccessForProfile(profile);
    if (!access) {
      return {
        allowed: false,
        isAdmin: false
      };
    }

    const members = await this.store.listAccessRecords();
    return {
      allowed: true,
      isAdmin: access.isAdmin,
      members,
      currentAccessId: access.accessId
    };
  }

  async addAccess(body: unknown, auth: AuthContext): Promise<HarmonyLedgerAccessRecord> {
    const { profile } = await this.requireAdmin(auth);
    const parsed = addAccessSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const payload = parsed.data;
    if (payload.userId) {
      const existing = await this.store.findAccessByUserId(payload.userId);
      if (existing) {
        throw new ValidationError("This person already has access.");
      }
    }

    const normalizedEmail = this.normalizeEmail(payload.email);
    if (normalizedEmail) {
      const existingEmail = await this.store.findAccessByEmail(normalizedEmail);
      if (existingEmail) {
        throw new ValidationError("That email already has access.");
      }
    }

    let targetProfile: UserProfile | null = null;
    if (payload.userId) {
      const fetched = await this.userStore.getUser(payload.userId);
      if (!fetched) {
        throw new ValidationError("Unable to find that user profile.");
      }
      targetProfile = fetched;
    }

    const displayName =
      payload.displayName ??
      targetProfile?.displayName ??
      payload.email ??
      targetProfile?.email ??
      "Harmony Member";

    const accessRecord = await this.store.createAccessRecord({
      accessId: nanoid(12),
      userId: payload.userId ?? targetProfile?.userId,
      email: payload.email ?? targetProfile?.email,
      normalizedEmail:
        normalizedEmail ?? this.normalizeEmail(targetProfile?.email) ?? undefined,
      displayName,
      isAdmin: payload.isAdmin ?? false,
      addedAt: isoNow(),
      addedBy: profile.userId,
      addedByName: displayNameFromProfile(profile)
    });

    return accessRecord;
  }

  async removeAccess(accessId: string, auth: AuthContext): Promise<void> {
    const { access: actingAccess } = await this.requireAdmin(auth);
    if (actingAccess.accessId === accessId) {
      throw new ValidationError("You cannot remove your own access.");
    }
    await this.store.deleteAccessRecord(accessId);
  }

  async listGroups(auth: AuthContext): Promise<HarmonyLedgerGroup[]> {
    await this.requireAccess(auth);
    await this.ensureDefaultGroups();
    return this.store.listGroups();
  }
}
