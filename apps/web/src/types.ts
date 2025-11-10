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
