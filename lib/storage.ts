import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

// Cloudflare R2 — S3-compatible API, zero egress fees (PRD §8).
// Local dev points R2_ENDPOINT at the MinIO container instead, which needs path-style addressing.
export const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: process.env.R2_ENDPOINT?.includes("localhost") ?? false,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

export const RESUME_BUCKET = process.env.R2_RESUME_BUCKET ?? "hire-stack-resumes";

// Presigned PUT keeps the app server out of the file-upload path (PRD §8).
export async function getResumeUploadUrl(candidateId: string, filename: string) {
  const key = `resumes/${candidateId}/${randomUUID()}-${filename}`;
  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: RESUME_BUCKET, Key: key }),
    { expiresIn: 300 },
  );
  return { uploadUrl, rawResumeUrl: key };
}

export async function getResumeBuffer(rawResumeUrl: string): Promise<Buffer> {
  const res = await r2.send(new GetObjectCommand({ Bucket: RESUME_BUCKET, Key: rawResumeUrl }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}
