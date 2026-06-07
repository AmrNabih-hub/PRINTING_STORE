import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function POST(request: Request) {
  try {
    const { filename, contentType } = await request.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: "Missing filename or contentType" }, { status: 400 });
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME || "printing-store-assets";

    // Fallback for Phase 1 Local Development without R2 credentials
    if (!accountId || !accessKeyId || !secretAccessKey) {
      console.warn("⚠️ No R2 credentials found in .env. Using local mock upload URL.");
      // We return a mock URL that our frontend will use, which routes back to a local mock-upload endpoint
      return NextResponse.json({
        uploadUrl: `http://localhost:3000/api/uploads/mock?filename=${encodeURIComponent(filename)}`,
        fileKey: `mock/${Date.now()}-${filename}`,
      });
    }

    const S3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const fileKey = `uploads/${Date.now()}-${filename}`;

    const url = await getSignedUrl(
      S3,
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
        ContentType: contentType,
      }),
      { expiresIn: 3600 }
    );

    return NextResponse.json({ uploadUrl: url, fileKey });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
