import { S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 — S3-compatible API, zero egress fees (PRD §8).
export const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

export const RESUME_BUCKET = process.env.R2_RESUME_BUCKET ?? "hire-stack-resumes";
