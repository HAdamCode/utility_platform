export interface TripSummary {
  trip: Trip;
  members: TripMember[];
  expenses: Expense[];
  receipts: Receipt[];
  settlements: Settlement[];
  balances: BalanceRow[];
  pendingSettlements: Settlement[];
  currentUserId: string;
}

export interface Trip {
  tripId: string;
  ownerId: string;
  name: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  currency: string;
}

export interface TripMember {
  tripId: string;
  memberId: string;
  displayName: string;
  email?: string;
  addedBy: string;
  createdAt: string;
}

export interface ExpenseAllocation {
  memberId: string;
  amount: number;
}

export interface Expense {
  tripId: string;
  expenseId: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  vendor?: string;
  category?: string;
  total: number;
  currency: string;
  tax?: number;
  tip?: number;
  paidByMemberId: string;
  sharedWithMemberIds: string[];
  allocations: ExpenseAllocation[];
  receiptId?: string;
  receiptPreviewUrl?: string;
}

export interface Receipt {
  tripId: string;
  receiptId: string;
  storageKey: string;
  uploadUrl: string;
  fileName: string;
  status: "PENDING_UPLOAD" | "UPLOADED" | "PROCESSING" | "COMPLETED" | "FAILED";
  extractedData?: TextractExtraction;
  createdAt: string;
  updatedAt: string;
}

export interface TextractExtraction {
  merchantName?: string;
  total?: number;
  subtotal?: number;
  tax?: number;
  tip?: number;
  date?: string;
  lineItems?: Array<{
    description?: string;
    quantity?: number;
    unitPrice?: number;
    total?: number;
  }>;
}

export interface Settlement {
  tripId: string;
  settlementId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  currency: string;
  note?: string;
  createdAt: string;
  confirmedAt?: string;
  createdBy: string;
}

export interface BalanceRow {
  memberId: string;
  displayName: string;
  balance: number;
}

export interface TripListResponse {
  trips: Trip[];
}

export interface ReceiptUploadResponse {
  tripId: string;
  receiptId: string;
  storageKey: string;
  uploadUrl: string;
  fileName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  displayName?: string;
  email?: string;
  displayNameLower?: string;
}

export type HarmonyLedgerEntryType =
  | "DONATION"
  | "INCOME"
  | "EXPENSE"
  | "REIMBURSEMENT";

export interface HarmonyLedgerEntry {
  entryId: string;
  type: HarmonyLedgerEntryType;
  amount: number;
  currency: string;
  description?: string;
  source?: string;
  category?: string;
  notes?: string;
  memberName?: string;
  groupId?: string;
  groupName?: string;
  recordedAt: string;
  recordedBy: string;
  recordedByName?: string;
}

export interface HarmonyLedgerTotals {
  donations: number;
  income: number;
  expenses: number;
  reimbursements: number;
  net: number;
}

export interface HarmonyLedgerGroup {
  groupId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
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

export interface HarmonyLedgerUnallocatedSummary {
  donations: number;
  income: number;
  expenses: number;
  reimbursements: number;
  transfersIn: number;
  transfersOut: number;
  net: number;
}

export interface HarmonyLedgerTransfer {
  transferId: string;
  amount: number;
  currency: string;
  fromGroupId?: string;
  fromGroupName?: string;
  toGroupId?: string;
  toGroupName?: string;
  note?: string;
  createdAt: string;
  createdBy: string;
  createdByName?: string;
}

export interface HarmonyLedgerEntriesResponse {
  entries: HarmonyLedgerEntry[];
  totals: HarmonyLedgerTotals;
  groups: HarmonyLedgerGroup[];
  groupSummaries: HarmonyLedgerGroupSummary[];
  unallocated: HarmonyLedgerUnallocatedSummary;
  transfers: HarmonyLedgerTransfer[];
}

export interface HarmonyLedgerOverviewResponse {
  totals: HarmonyLedgerTotals;
  groups: HarmonyLedgerGroupSummary[];
  unallocated: HarmonyLedgerUnallocatedSummary;
  transfers: HarmonyLedgerTransfer[];
}

export interface HarmonyLedgerAccessRecord {
  accessId: string;
  userId?: string;
  email?: string;
  displayName?: string;
  isAdmin: boolean;
  addedAt: string;
  addedBy: string;
  addedByName?: string;
}

export interface HarmonyLedgerAccessResponse {
  allowed: boolean;
  isAdmin: boolean;
  currentAccessId?: string;
  members?: HarmonyLedgerAccessRecord[];
}
