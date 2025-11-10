import {
  AnalyzeExpenseCommand,
  TextractClient,
  type ExpenseDocument,
  type AnalyzeExpenseCommandInput
} from "@aws-sdk/client-textract";
import { loadConfig } from "../config.js";
import type { TextractExtraction } from "../types.js";

let textractClient: TextractClient | null = null;
const getTextractClient = () => {
  if (!textractClient) {
    const { region } = loadConfig();
    textractClient = new TextractClient({ region });
  }
  return textractClient;
};

const getSummaryValue = (
  document: ExpenseDocument,
  ...types: string[]
): string | undefined => {
  for (const type of types) {
    const field = document.SummaryFields?.find(
      (summary) =>
        summary.Type?.Text === type || summary.Type?.Text?.includes(type)
    );
    const value = field?.ValueDetection?.Text ?? field?.ValueDetection?.Text;
    if (value) {
      return value;
    }
  }
  return undefined;
};

const getSummaryNumber = (
  document: ExpenseDocument,
  type: string
): number | undefined => {
  const value = getSummaryValue(document, type);
  if (!value) return undefined;
  const normalized = value.replace(/[^0-9.\-]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const analyzeDocument = async (
  input: AnalyzeExpenseCommandInput
): Promise<TextractExtraction> => {
  const textract = getTextractClient();
  const response = await textract.send(
    new AnalyzeExpenseCommand({
      ...input
    })
  );

  const document = response.ExpenseDocuments?.[0];
  if (!document) {
    return {};
  }

  const extraction: TextractExtraction = {
    merchantName:
      getSummaryValue(
        document,
        "VENDOR_NAME",
        "SUPPLIER_NAME",
        "MERCHANT_NAME",
        "PAYEE_NAME",
        "BUYER_NAME",
        "RECEIVER_NAME"
      ),
    total: getSummaryNumber(document, "TOTAL"),
    subtotal: getSummaryNumber(document, "SUBTOTAL"),
    tax: getSummaryNumber(document, "TAX"),
    tip: getSummaryNumber(document, "TIP"),
    date: getSummaryValue(document, "INVOICE_RECEIPT_DATE")
  };

  const lineItems: TextractExtraction["lineItems"] = [];
  const groups = document.LineItemGroups ?? [];
  for (const group of groups) {
    for (const item of group.LineItems ?? []) {
      const fields = item.LineItemExpenseFields ?? [];
      const getField = (type: string) =>
        fields.find((field) => field.Type?.Text === type)?.ValueDetection?.Text;
      const parseNumber = (value?: string) => {
        if (!value) return undefined;
        const normalized = value.replace(/[^0-9.\-]/g, "");
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : undefined;
      };

      lineItems.push({
        description: getField("ITEM"),
        quantity: parseNumber(getField("QUANTITY")),
        unitPrice: parseNumber(getField("UNIT_PRICE")),
        total: parseNumber(getField("PRICE"))
      });
    }
  }

  if (lineItems.length) {
    extraction.lineItems = lineItems;
  }

  return extraction;
};

export const analyzeReceipt = async (
  bucket: string,
  key: string
): Promise<TextractExtraction> =>
  analyzeDocument({
    Document: {
      S3Object: {
        Bucket: bucket,
        Name: key
      }
    }
  });

export const analyzeReceiptBytes = async (
  bytes: Uint8Array
): Promise<TextractExtraction> =>
  analyzeDocument({
    Document: {
      Bytes: bytes
    }
  });
