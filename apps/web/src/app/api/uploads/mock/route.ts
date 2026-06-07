import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");

    if (!filename) {
      return NextResponse.json({ error: "Missing filename parameter" }, { status: 400 });
    }

    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ensure uploads directory exists
    const uploadsDir = join(process.cwd(), "public", "uploads", "mock");
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const filePath = join(uploadsDir, filename);
    await writeFile(filePath, buffer);

    return NextResponse.json({ success: true, message: "Mock upload successful" });
  } catch (error) {
    console.error("Mock upload error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
