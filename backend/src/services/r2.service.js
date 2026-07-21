import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import path from "path";
import { v4 as uuid } from "uuid";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
]);
const MAX_BYTES = 30 * 1024 * 1024; // 30 MB
const R2_KEY_PREFIXES = ["recruitment/", "documents/", "payslips/"];

function publicUrl() {
  return process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
}

function r2Client() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export function objectKeyFromUrl(fileUrl) {
  if (!fileUrl) return null;
  const baseUrl = publicUrl();
  if (baseUrl && fileUrl.startsWith(`${baseUrl}/`)) return fileUrl.slice(baseUrl.length + 1);
  const prefix = R2_KEY_PREFIXES.find((keyPrefix) => fileUrl.includes(keyPrefix));
  return prefix ? fileUrl.slice(fileUrl.indexOf(prefix)) : fileUrl;
}

export function publicFileUrl(fileUrl) {
  if (/^https?:\/\//i.test(fileUrl || "") && !R2_KEY_PREFIXES.some((keyPrefix) => fileUrl.includes(keyPrefix))) {
    return fileUrl;
  }
  const key = objectKeyFromUrl(fileUrl);
  const baseUrl = publicUrl();
  if (!key || !baseUrl) return fileUrl || null;
  return `${baseUrl}/${key}`;
}

export function validateUpload(file) {
  if (!file) throw Object.assign(new Error("No file provided"), { statusCode: 400 });
  if (file.size > MAX_BYTES) throw Object.assign(new Error("File exceeds 30 MB limit"), { statusCode: 413 });
  if (!ALLOWED_MIME.has(file.mimetype))
    throw Object.assign(new Error("Only PDF, DOCX, ZIP allowed"), { statusCode: 415 });
}

export async function uploadToR2(file, folder = "recruitment") {
  validateUpload(file);
  const baseUrl = publicUrl();
  if (!baseUrl) throw Object.assign(new Error("R2_PUBLIC_URL is not configured"), { statusCode: 500 });
  const ext = path.extname(file.originalname);
  const key = `${folder}/${uuid()}${ext}`;

  await r2Client().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentLength: file.size,
    })
  );

  return `${baseUrl}/${key}`;
}

export async function deleteFromR2(fileUrl) {
  const key = objectKeyFromUrl(fileUrl);
  if (!key) return;
  await r2Client().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
}

export async function getSignedDownloadUrl(fileUrl, expiresIn = 3600) {
  const key = objectKeyFromUrl(fileUrl);
  if (!key) return null;
  return getSignedUrl(r2Client(), new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }), { expiresIn });
}

export async function getFileFromR2(fileUrl) {
  const key = objectKeyFromUrl(fileUrl);
  if (!key) throw Object.assign(new Error("File not found"), { statusCode: 404 });
  return r2Client().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
}
