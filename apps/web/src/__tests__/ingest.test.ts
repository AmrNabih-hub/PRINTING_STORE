import { POST } from '../app/api/assets/ingest/route';
import { NextRequest } from 'next/server';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';

describe('Asset Ingestion Pipeline', () => {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  let tempTestFiles: string[] = [];

  beforeAll(async () => {
    await fs.promises.mkdir(uploadsDir, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup any thumbnails created during the tests
    const files = await fs.promises.readdir(uploadsDir);
    for (const file of files) {
      if (file.startsWith('thumb_') && file.includes('test-image')) {
        try {
          await fs.promises.unlink(path.join(uploadsDir, file));
        } catch (_) {}
      }
    }
  });

  it('successfully ingests a valid PNG image, resizes, runs AI check, and cleans temp upload file', async () => {
    const fileBuffer = Buffer.from(pngBase64, 'base64');
    const file = new File([fileBuffer], 'test-image.png', { type: 'image/png' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('widthCm', '40');
    formData.append('heightCm', '30');

    const request = new NextRequest('http://localhost:3000/api/assets/ingest', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json() as any;
    expect(data.success).toBe(true);
    expect(data.originalName).toBe('test-image.png');
    expect(data.mimeType).toBe('image/png');
    expect(data.widthPx).toBe(1);
    expect(data.heightPx).toBe(1);
    expect(data.thumbnailUrl).toContain('/uploads/thumb_');
    expect(data.aiAssessment).toBeDefined();
    expect(data.aiAssessment.printReadinessScore).toBeGreaterThanOrEqual(0);

    // Verify temp raw file is deleted as part of GC guidelines
    const uploadFiles = await fs.promises.readdir(uploadsDir);
    const tempFileExists = uploadFiles.some((name) => name.startsWith('temp_') && name.includes('test-image'));
    expect(tempFileExists).toBe(false);
  });

  it('rejects files exceeding the 80MB limit', async () => {
    const dummyBuffer = Buffer.alloc(10);
    const largeFile = new File([dummyBuffer], 'test-image.png', { type: 'image/png' });
    Object.defineProperty(largeFile, 'size', { value: 85 * 1024 * 1024 });

    const mockFormData = new FormData();
    mockFormData.append('file', largeFile);

    const request = new NextRequest('http://localhost:3000/api/assets/ingest', {
      method: 'POST',
    });
    request.formData = async () => mockFormData;

    const response = await POST(request);
    expect(response.status).toBe(413);

    const data = await response.json() as any;
    expect(data.error).toBe('FILE_TOO_LARGE');
  });

  it('rejects unsupported file formats', async () => {
    const file = new File([Buffer.from('hello')], 'document.pdf', { type: 'application/pdf' });

    const formData = new FormData();
    formData.append('file', file);

    const request = new NextRequest('http://localhost:3000/api/assets/ingest', {
      method: 'POST',
      body: formData,
    });

    // Note: The format validation is handled on the client in the Dropzone,
    // but the API also rejects empty/no-file or crashes gracefully.
    // Let's check how the endpoint handles unsupported files. If sharp cannot process PDF, it will catch in try/catch.
    const response = await POST(request);
    expect(response.status).toBe(500);

    const data = await response.json() as any;
    expect(data.error).toBe('INGESTION_FAILED');
  });
});
