import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { verifySessionToken } from '@printing-store/core-logic';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const cookieToken = request.cookies.get('session_token')?.value;
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = bearerToken || cookieToken;

    if (!token) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const payload = await verifySessionToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('avatar') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'NO_FILE_UPLOADED' }, { status: 400 });
    }

    // Accept only image files
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'INVALID_FILE_TYPE' }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    // Sanitize extension
    const ext = path.extname(file.name) || '.png';
    const filename = `avatar_${payload.userId}_${Date.now()}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    // Save binary data
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.promises.writeFile(filePath, buffer);

    const avatarUrl = `/uploads/avatars/${filename}`;

    // Ensure the table structure has the column
    await query('ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) DEFAULT NULL;');

    // Update profile
    await query(
      'UPDATE public.profiles SET avatar_url = $1 WHERE id = $2',
      [avatarUrl, payload.userId]
    );

    return NextResponse.json({ success: true, avatarUrl });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Avatar upload error:', error);
    return NextResponse.json(
      { error: 'UPLOAD_FAILED', message: errMsg },
      { status: 500 }
    );
  }
}
