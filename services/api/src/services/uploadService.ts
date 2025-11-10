import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";
import { loadConfig, type AppConfig } from "../config.js";

let cachedConfig: AppConfig | null = null;
const getConfig = () => {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
};

let s3Client: S3Client | null = null;
const getS3Client = () => {
  if (!s3Client) {
    const { region } = getConfig();
    s3Client = new S3Client({ region });
  }
  return s3Client;
};

export interface ReceiptUploadResult {
  receiptId: string;
  storageKey: string;
  uploadUrl: string;
}

export const generateReceiptUpload = async (
  tripId: string,
  fileName: string,
  contentType: string
): Promise<ReceiptUploadResult> => {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const extension = sanitizedName.includes(".")
    ? sanitizedName.split(".").pop()
    : "bin";
  const receiptId = `rec_${nanoid(10)}`;
  const storageKey = `trips/${tripId}/receipts/${receiptId}.${extension}`;

  const config = getConfig();
  const s3 = getS3Client();
  const command = new PutObjectCommand({
    Bucket: config.receiptBucket,
    Key: storageKey,
    ContentType: contentType
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: config.signedUrlExpirySeconds
  });

  return { receiptId, storageKey, uploadUrl };
};

export const generateReceiptDownloadUrl = async (
  storageKey: string
): Promise<string> => {
  const config = getConfig();
  const s3 = getS3Client();
  const command = new GetObjectCommand({
    Bucket: config.receiptBucket,
    Key: storageKey
  });

  return getSignedUrl(s3, command, {
    expiresIn: config.signedUrlExpirySeconds
  });
};
