import type { ExtractedOpenMat, ValidatedOpenMat } from './types';
import type { ConfidenceLevel, MartialArtType, AgePolicy } from '@/lib/types';

/**
 * Stage 5: Validate and normalize extracted open mats for database insertion.
 */
export function validateAndNormalize(
  extracted: ExtractedOpenMat[],
  gymId: string,
  sourceUrl: string,
  parserConfidence: number,
  needsReview: boolean
): ValidatedOpenMat[] {
  const now = new Date().toISOString();
  const results: ValidatedOpenMat[] = [];

  for (const item of extracted) {
    const startTime = normalizeTime(item.startTime);
    if (!startTime || !isValidTime(startTime) || !isReasonableTime(startTime)) continue;

    let endTime = item.endTime ? normalizeTime(item.endTime) : null;
    if (!endTime) {
      endTime = addHours(startTime, 2);
    }
    if (!isValidTime(endTime)) continue;

    // Ensure start < end
    if (startTime >= endTime) continue;

    const type = detectMatType(item.className);
    const agePolicy = detectAgePolicy(item.className);
    const confidenceScore = mapConfidence(parserConfidence);

    results.push({
      gym_id: gymId,
      day_of_week: item.dayOfWeek,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      type,
      recurring: true,
      age_policy: agePolicy,
      source_type: 'website_scrape',
      source_url: sourceUrl,
      last_source_check: now,
      needs_review: needsReview,
      confidence_score: confidenceScore,
      confirmation_method: 'website_scrape',
    });
  }

  return results;
}

function normalizeTime(time: string): string | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1]);
  const m = parseInt(match[2]);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function isValidTime(time: string): boolean {
  const [h, m] = time.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function isReasonableTime(time: string): boolean {
  const h = parseInt(time.split(':')[0]);
  return h >= 5 && h <= 23;
}

function addHours(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  const newH = Math.min(23, h + hours);
  return `${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function detectMatType(className: string): MartialArtType {
  const lower = className.toLowerCase();
  if (lower.includes('no-gi') || lower.includes('nogi') || lower.includes('no gi')) return 'nogi';
  if (/\bgi\b/.test(lower) && !lower.includes('no')) return 'gi';
  return 'both';
}

function detectAgePolicy(className: string): AgePolicy {
  const lower = className.toLowerCase();
  if (lower.includes('kids') || lower.includes('children') || lower.includes('youth') || lower.includes('junior')) {
    return 'kids_separate';
  }
  if (lower.includes('adult')) return 'adults_only';
  return 'unknown';
}

function mapConfidence(parserConfidence: number): ConfidenceLevel {
  if (parserConfidence >= 0.7) return 'medium';
  if (parserConfidence >= 0.4) return 'low';
  return 'unverified';
}
