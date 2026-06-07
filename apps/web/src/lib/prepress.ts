import sharp from 'sharp';

export interface PrepressResult {
  artworkClassification: string;
  estimatedInkDensityFactor: number;
  compressionArtifactsDetected: boolean;
  printReadinessScore: number;
  riskAssessment: string;
  isPotentialPricingGame: boolean;
  rawAiPayload: Record<string, any>;
}

export async function analyzeImageLocally(
  filePath: string,
  widthCm: number,
  heightCm: number
): Promise<PrepressResult> {
  const image = sharp(filePath);
  const metadata = await image.metadata();
  const stats = await image.stats();

  const channelMeans = stats.channels.map(c => c.mean);
  const avgMean = channelMeans.reduce((a, b) => a + b, 0) / channelMeans.length;

  // Ink Density maps linearly from 0.50 (pure white) to 2.00 (pure black)
  const densityFactor = Number((0.50 + 1.50 * (1 - avgMean / 255)).toFixed(2));

  const isThumbnail = filePath.includes('thumb_');

  // Print readiness depends on pixels per centimeter (assumed high if analyzing thumbnail)
  const ppcWidth = isThumbnail ? 120 : (metadata.width || 0) / widthCm;
  const ppcHeight = isThumbnail ? 120 : (metadata.height || 0) / heightCm;
  const minPpc = Math.min(ppcWidth, ppcHeight);

  // 30 PPC is roughly 75 DPI. Below 28 PPC, print quality is pixelated.
  const readinessScore = isThumbnail ? 98 : Math.max(35, Math.min(100, Math.round(minPpc * 1.5 + 40)));
  const compressionArtifacts = isThumbnail ? false : minPpc < 28;
  const isGame = densityFactor > 1.70;

  const classification = densityFactor > 1.5
    ? 'heavy_oil_painting'
    : densityFactor < 0.8
      ? 'line_art'
      : 'photography';

  return {
    artworkClassification: classification,
    estimatedInkDensityFactor: densityFactor,
    compressionArtifactsDetected: compressionArtifacts,
    printReadinessScore: readinessScore,
    riskAssessment: compressionArtifacts
      ? `Low resolution (${Math.round(minPpc * 2.54)} DPI) detected. Details may be pixelated at ${widthCm}x${heightCm}cm.`
      : 'Image has sufficient resolution and contrast for clean scaling.',
    isPotentialPricingGame: isGame,
    rawAiPayload: {
      mock: true,
      localAnalysis: true,
      avgMean,
      minPpc,
      timestamp: new Date().toISOString()
    }
  };
}
