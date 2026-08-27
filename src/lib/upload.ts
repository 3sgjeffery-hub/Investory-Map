import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const S3_ENDPOINT = (process.env.S3_ENDPOINT ?? "").replace(/\/$/, "");
const S3_PUBLIC_URL = (process.env.S3_PUBLIC_URL ?? "").replace(/\/$/, "");
const BUCKET = process.env.S3_BUCKET ?? "investory-uploads";

const s3 = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT, forcePathStyle: true } : {}),
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "",
  },
});

export async function uploadFile(
  buffer: Buffer,
  contentType: string,
  folder: string = "photos"
): Promise<string> {
  const ext = contentType.split("/")[1] || "bin";
  const key = `${folder}/${uuidv4()}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  if (S3_PUBLIC_URL) return `${S3_PUBLIC_URL}/${key}`;
  return `${S3_ENDPOINT}/${BUCKET}/${key}`;
}

export async function deleteFile(url: string): Promise<void> {
  const key = url.split(`/${BUCKET}/`)[1];
  if (!key) return;

  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}
