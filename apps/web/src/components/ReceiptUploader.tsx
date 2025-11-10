import { FormEvent, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { ReceiptUploadResponse } from "../types";

interface ReceiptUploaderProps {
  tripId: string;
  onUploaded: () => void;
}

const ReceiptUploader = ({ tripId, onUploaded }: ReceiptUploaderProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [isUploading, setUploading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setStatus("");
    setUploading(true);

    try {
      const receipt = await api.post<ReceiptUploadResponse>(
        `/trips/${tripId}/receipts`,
        {
          fileName: file.name,
          contentType: file.type || "application/octet-stream"
        }
      );

      const uploadResponse = await fetch(receipt.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream"
        },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      setStatus("Receipt uploaded! Textract will process shortly.");
      setFile(null);
      onUploaded();
    } catch (error) {
      if (error instanceof ApiError) {
        setStatus(error.message);
      } else if (error instanceof Error) {
        setStatus(error.message);
      } else {
        setStatus("Upload failed");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="list">
      <div className="input-group">
        <label htmlFor="receipt-file">Receipt</label>
        <input
          id="receipt-file"
          type="file"
          accept="image/*,application/pdf"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </div>

      {status && <p className="muted">{status}</p>}

      <button type="submit" className="secondary" disabled={!file || isUploading}>
        {isUploading ? "Uploading…" : "Upload receipt"}
      </button>
    </form>
  );
};

export default ReceiptUploader;
