import type { S3Event, Context, S3EventRecord } from "aws-lambda";
import { TripStore } from "../data/tripStore.js";
import { analyzeReceipt } from "../services/textractService.js";

const tripStore = new TripStore();

const isoNow = () => new Date().toISOString();

interface ReceiptIdentifier {
  tripId: string;
  receiptId: string;
}

const extractIds = (record: S3EventRecord): ReceiptIdentifier | null => {
  const key = decodeURIComponent(record.s3.object.key);
  const match = key.match(/^trips\/([^/]+)\/receipts\/(rec_[^/.]+)/);
  if (!match) {
    console.warn("Unable to parse key for receipt", key);
    return null;
  }
  return {
    tripId: match[1],
    receiptId: match[2]
  };
};

export const handler = async (event: S3Event, _context: Context): Promise<void> => {
  await Promise.all(
    event.Records.map(async (record) => {
      const ids = extractIds(record);
      if (!ids) return;
      const { tripId, receiptId } = ids;
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key);

      try {
        await tripStore.updateReceiptExtraction(tripId, receiptId, {
          status: "PROCESSING",
          updatedAt: isoNow()
        });

        const extractedData = await analyzeReceipt(bucket, key);

        await tripStore.updateReceiptExtraction(tripId, receiptId, {
          status: "COMPLETED",
          extractedData,
          updatedAt: isoNow()
        });
      } catch (error) {
        console.error("Failed to process receipt", { tripId, receiptId, error });
        await tripStore.updateReceiptExtraction(tripId, receiptId, {
          status: "FAILED",
          updatedAt: isoNow()
        });
      }
    })
  );
};
