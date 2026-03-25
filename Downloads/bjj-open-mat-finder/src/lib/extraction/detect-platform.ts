import type { PlatformDetectionResult } from './types';
import { parsers } from './parsers/registry';

const MIN_CONFIDENCE = 0.5;

/**
 * Stage 3: Run all registered parsers' detect() functions against the HTML.
 * Return the parser with the highest confidence above threshold.
 */
export function detectPlatform(html: string): PlatformDetectionResult | null {
  let best: PlatformDetectionResult | null = null;

  for (const parser of parsers) {
    const result = parser.detect(html);
    if (result.detected && result.confidence >= MIN_CONFIDENCE) {
      if (!best || result.confidence > best.confidence) {
        best = {
          platform: parser.name,
          parserName: parser.name,
          confidence: result.confidence,
        };
      }
    }
  }

  return best;
}

/**
 * Get a parser by name from the registry.
 */
export function getParser(name: string) {
  return parsers.find((p) => p.name === name) ?? null;
}
