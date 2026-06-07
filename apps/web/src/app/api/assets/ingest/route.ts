import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import sharp from 'sharp';
import { getAIAuditor } from '@printing-store/core-logic';
import { analyzeImageLocally } from '../../../../lib/prepress';

// Explicitly run on Node.js runtime for native C++ sharp binding support
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let tempFilePath = '';
  let image: sharp.Sharp | null = null;
  let thumbBuffer: Buffer | null = null;
  let formData: FormData | null = null;
  let file: File | null = null;
  
  try {
    formData = await request.formData();
    file = formData.get('file') as File | null;
    const widthCm = Number(formData.get('widthCm') || 50);
    const heightCm = Number(formData.get('heightCm') || 50);

    if (!file) {
      return NextResponse.json({ error: 'NO_FILE_UPLOADED' }, { status: 400 });
    }

    // Client-side payload size limit protection backup (80MB max)
    if (file.size > 80 * 1024 * 1024) {
      return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 413 });
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    
    // Ensure public uploads directory exists
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    const tempFileName = `temp_${Date.now()}_${file.name}`;
    tempFilePath = path.join(uploadsDir, tempFileName);

    // Save temporary raw binary print asset to disk using streams to avoid keeping huge buffers in memory
    const writeStream = fs.createWriteStream(tempFilePath);
    const fileStream = file.stream();
    const nodeReadable = Readable.from(fileStream as any);
    
    await new Promise<void>((resolve, reject) => {
      nodeReadable.pipe(writeStream);
      writeStream.on('finish', () => resolve());
      writeStream.on('error', (err) => reject(err));
    });

    // Scrape file dimensions and metadata details using sharp directly from the disk file
    image = sharp(tempFilePath);
    const metadata = await image.metadata();

    const thumbnailFileName = `thumb_${Date.now()}_${path.parse(file.name).name}.jpg`;
    const thumbnailPath = path.join(uploadsDir, thumbnailFileName);

    // Hardware-accelerated scaling to a maximum of 512px (retaining visual ratio)
    await image
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .toFormat('jpeg', { quality: 80 })
      .toFile(thumbnailPath);

    // Read the scaled thumbnail to feed the AI Pre-Press validation pipeline
    thumbBuffer = await fs.promises.readFile(thumbnailPath);
    const thumbBase64 = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;

    // Execute vision checks
    const auditor = getAIAuditor();
    let aiResult = await auditor.auditImage(thumbBase64, widthCm, heightCm);

    if (aiResult.rawAiPayload?.mock || aiResult.artworkClassification === 'error_fallback') {
      try {
        const localResult = await analyzeImageLocally(tempFilePath, widthCm, heightCm);
        aiResult = localResult;
      } catch (err) {
        console.error('Failed to compute local sharp metrics, using mock fallback:', err);
      }
    }

    const resultPayload = {
      success: true,
      originalName: file.name,
      mimeType: file.type,
      widthPx: metadata.width || 0,
      heightPx: metadata.height || 0,
      thumbnailUrl: `/uploads/${thumbnailFileName}`,
      aiAssessment: {
        artworkClassification: aiResult.artworkClassification,
        estimatedInkDensityFactor: Number(aiResult.estimatedInkDensityFactor),
        compressionArtifactsDetected: aiResult.compressionArtifactsDetected,
        printReadinessScore: Number(aiResult.printReadinessScore),
        riskAssessment: aiResult.riskAssessment,
        isPotentialPricingGame: aiResult.isPotentialPricingGame,
        rawAiPayload: aiResult.rawAiPayload,
      }
    };

    return NextResponse.json(resultPayload);

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Ingestion pipeline error:', error);
    return NextResponse.json(
      { error: 'INGESTION_FAILED', message: errMsg },
      { status: 500 }
    );
  } finally {
    // Thorough memory cleanup triggers to ensure no heavy instances survive upload lifecycle
    image = null;
    thumbBuffer = null;
    formData = null;
    file = null;

    if (tempFilePath) {
      try {
        if (fs.existsSync(tempFilePath)) {
          await fs.promises.unlink(tempFilePath);
        }
      } catch (err) {
        console.error('Failed to clean temp file during ingestion GC:', err);
      }
    }

    if (global.gc) {
      try {
        global.gc();
      } catch (e) {
        // Expose GC fallback silencer
      }
    }
  }
}
