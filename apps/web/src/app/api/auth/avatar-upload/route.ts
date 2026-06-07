import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { verifySessionToken } from "@printing-store/core-logic";
import { getCloudflareContext } from "@/lib/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { profiles } from '@printing-store/core-logic/src/schema';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const __body = await request.json();
    const __schema = z.object({ filename: z.any(), contentType: z.any() }).nonstrict();
    const { filename, contentType  } = __schema.parse(__body);

    if (!filename || !contentType) {
      return NextResponse.json({ error: "Missing filename or contentType" }, { status: 400 });
    }

    const cookieToken = request.cookies.get('session_token')?.value;
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = bearerToken || cookieToken;

    if (!token) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const payload = await verifySessionToken(token);
    if (!payload) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const userId = (payload as any).userId;

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME || "printing-store-assets";

    let uploadUrl = "";
    let fileKey = "";

    if (!accountId || !accessKeyId || !secretAccessKey) {
      console.warn("⚠️ No R2 credentials found in .env. Using local mock upload URL.");
      fileKey = `mock/avatar-${userId}-${Date.now()}-${filename}`;
      uploadUrl = `http://localhost:3000/api/uploads/mock?filename=${encodeURIComponent(filename)}`;
    } else {
      const S3 = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      fileKey = `avatars/${userId}-${Date.now()}-${filename}`;
      uploadUrl = await getSignedUrl(
        S3,
        new PutObjectCommand({
          Bucket: bucketName,
          Key: fileKey,
          ContentType: contentType,
        }),
        { expiresIn: 3600 }
      );
    }

    const publicUrl = process.env.NEXT_PUBLIC_R2_URL 
      ? `${process.env.NEXT_PUBLIC_R2_URL}/${fileKey}` 
      : `/${fileKey}`;

    const { DB } = await getCloudflareContext();
    const db = drizzle(DB);

    await db.update(profiles)
      .set({ avatarUrl: publicUrl })
      .where(eq(profiles.id, userId));

    return NextResponse.json({ uploadUrl, fileKey, avatarUrl: publicUrl });
  } catch (error) {
    console.error("Error in avatar-upload presigned generation:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
