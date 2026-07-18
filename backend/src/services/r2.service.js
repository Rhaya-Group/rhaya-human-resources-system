import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import path from "path";
import { v4 as uuid } from "uuid";

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
]);
const MAX_BYTES = 30 * 1024 * 1024; // 30 MB

export function validateUpload(file) {
  if (!file) throw Object.assign(new Error("No file provided"), { status: 400 });
  if (file.size > MAX_BYTES) throw Object.assign(new Error("File exceeds 30 MB limit"), { status: 413 });
  if (!ALLOWED_MIME.has(file.mimetype))
    throw Object.assign(new Error("Only PDF, DOCX, ZIP allowed"), { status: 415 });
}

export async function uploadToR2(file, folder = "recruitment") {
  validateUpload(file);
  if (!PUBLIC_URL) throw Object.assign(new Error("R2_PUBLIC_URL is not configured"), { statusCode: 500 });
  const ext = path.extname(file.originalname);
  const key = `${folder}/${uuid()}${ext}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentLength: file.size,
    })
  );

  return `${PUBLIC_URL}/${key}`;
}

export async function deleteFromR2(fileUrl) {
  if (!fileUrl || !PUBLIC_URL) return;
  const key = fileUrl.replace(`${PUBLIC_URL}/`, "");
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function getSignedDownloadUrl(fileUrl, expiresIn = 3600) {
  if (!fileUrl || !PUBLIC_URL) return null;
  const key = fileUrl.replace(`${PUBLIC_URL}/`, "");
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}
