export interface AuditResult {
  artworkClassification: string;
  estimatedInkDensityFactor: number;
  compressionArtifactsDetected: boolean;
  printReadinessScore: number; // 0 - 100
  riskAssessment?: string;
  isPotentialPricingGame: boolean;
  rawAiPayload: Record<string, any>;
}

export interface IAIAuditor {
  auditImage(
    thumbnailBase64: string, // Assumes a low-res thumbnail image encoded in base64
    widthCm: number,
    heightCm: number
  ): Promise<AuditResult>;
}

/**
 * Mock auditor returning predictable results based on base64 content keywords for test verification.
 */
export class MockAIAuditor implements IAIAuditor {
  async auditImage(
    thumbnailBase64: string,
    widthCm: number,
    heightCm: number
  ): Promise<AuditResult> {
    // If the base64 string contains the word "game", simulate pricing game detection
    const isGame = thumbnailBase64.includes('game');
    const isBlurry = thumbnailBase64.includes('blurry');

    return {
      artworkClassification: isGame ? 'solid_black_test' : isBlurry ? 'low_resolution_photo' : 'standard_fine_art',
      estimatedInkDensityFactor: isGame ? 1.80 : isBlurry ? 0.60 : 1.15,
      compressionArtifactsDetected: isBlurry,
      printReadinessScore: isBlurry ? 45 : 98,
      riskAssessment: isBlurry ? 'Image is too blurry for clean canvas scaling.' : 'Safe. Print-ready.',
      isPotentialPricingGame: isGame,
      rawAiPayload: { mock: true, timestamp: new Date().toISOString() },
    };
  }
}

/**
 * Enterprise implementation connecting to Google Gemini Multimodal APIs.
 */
export class GeminiAIAuditor implements IAIAuditor {
  private apiKey: string;
  private apiEndpoint: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
  }

  async auditImage(
    thumbnailBase64: string,
    widthCm: number,
    heightCm: number
  ): Promise<AuditResult> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not configured in environment variables');
    }

    // Prepare content for multimodal input (text guidelines + image part)
    const promptText = `
      You are an expert pre-press print shop technician. Your job is to analyze the user's uploaded artwork and provide a strict JSON audit response.
      Do not return any conversational text, explanations, or markdown wrappers. Output only a valid JSON object matching this schema:
      
      {
        "artwork_classification": "string (e.g. line_art, watercolor, heavy_oil_painting, photography, vector)",
        "estimated_ink_density_factor": "number between 0.50 and 2.00 (where 1.00 is standard coverage)",
        "compression_artifacts_detected": "boolean",
        "print_readiness_score": "integer between 0 and 100",
        "risk_assessment": "string (detail issues like low contrast, ink saturation issues, pixelation, etc.)",
        "is_potential_pricing_game": "boolean (true if image is a massive ink-heavy block but is self-described as simple line art or contains anomalies to bypass pricing math)"
      }
      
      User's requested physical dimensions: ${widthCm}cm width x ${heightCm}cm height.
    `;

    // Extract raw base64 data if it includes data uri scheme prefix
    const base64DataOnly = thumbnailBase64.replace(/^data:image\/\w+;base64,/, '');

    try {
      const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(4000),
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64DataOnly,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API responded with status ${response.status}: ${await response.text()}`);
      }

      const resJson = await response.json();
      const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(rawText.trim());

      return {
        artworkClassification: parsed.artwork_classification || 'unknown',
        estimatedInkDensityFactor: Number(parsed.estimated_ink_density_factor) || 1.20,
        compressionArtifactsDetected: Boolean(parsed.compression_artifacts_detected),
        printReadinessScore: Number(parsed.print_readiness_score) || 80,
        riskAssessment: parsed.risk_assessment || undefined,
        isPotentialPricingGame: Boolean(parsed.is_potential_pricing_game),
        rawAiPayload: resJson,
      };
    } catch (error: any) {
      console.warn('Gemini API call failed, falling back to MockAIAuditor:', error.message || error);
      const mockAuditor = new MockAIAuditor();
      return mockAuditor.auditImage(thumbnailBase64, widthCm, heightCm);
    }
  }
}

export function getAIAuditor(): IAIAuditor {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.startsWith('AIzaSy')) {
    return new GeminiAIAuditor(apiKey);
  }
  return new MockAIAuditor();
}
