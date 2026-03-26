import type { AIExtractedOpenMat, ExtractedOpenMat, ValidatedOpenMat } from './types';
import type {
  ConfidenceLevel, MartialArtType, AgePolicy,
  VisitorAccess, IntensityLevel, WomenPresence,
  CoachingPresence, BeginnerFriendly, DropInFee,
} from '@/lib/types';

// --- Valid value sets for runtime validation ---

const VALID_VISITOR_ACCESS: VisitorAccess[] = ['open_to_all', 'contact_first', 'members_only', 'unknown'];
const VALID_INTENSITY: IntensityLevel[] = ['casual', 'moderate', 'competition', 'varies', 'unknown'];
const VALID_COACHING: CoachingPresence[] = ['yes', 'sometimes', 'no', 'unknown'];
const VALID_BEGINNER: BeginnerFriendly[] = ['yes', 'somewhat', 'not_really', 'unknown'];
const VALID_WOMEN: WomenPresence[] = ['regularly_attend', 'sometimes', 'rarely', 'women_specific', 'unknown'];

/**
 * Stage 5: Validate and normalize AI-extracted open mats for database insertion.
 *
 * Takes raw AI extraction output and produces ValidatedOpenMat[] ready to be
 * saved to the database, applying time normalization, field mapping, and
 * default values for missing data.
 */
export function validateAIExtraction(
  extracted: AIExtractedOpenMat[],
  gymId: string,
  sourceUrl: string,
  sourceType: 'website_scrape' | 'image_ocr' | 'google_search',
  confidenceNote: string | null
): ValidatedOpenMat[] {
  const now = new Date().toISOString();
  const results: ValidatedOpenMat[] = [];

  for (const item of extracted) {
    const startTime = normalizeTime(item.start_time);
    if (!startTime || !isValidTime(startTime) || !isReasonableTime(startTime)) continue;

    let endTime = item.end_time ? normalizeTime(item.end_time) : null;
    if (!endTime) {
      endTime = addHours(startTime, 2);
    }
    if (!isValidTime(endTime)) continue;

    // Ensure start < end
    if (startTime >= endTime) continue;

    // Map AI type: 'unknown' -> 'both'
    const type: MartialArtType = item.type === 'unknown' ? 'both' : item.type;

    const agePolicy = detectAgePolicy(item.class_name);

    // Map AI-enriched fields
    const visitorAccess = castToValid<VisitorAccess>(item.visitor_access, VALID_VISITOR_ACCESS, 'unknown');
    const intensity = castToValid<IntensityLevel>(item.intensity, VALID_INTENSITY, 'unknown');
    const coachingPresent = mapCoachingPresent(item.coaching_present);
    const beginnerFriendly = mapBeginnerFriendly(item.beginner_friendly);
    const womenPresence = mapWomenPresence(item.women_only);
    const dropInFee = mapDropInFee(item.drop_in_fee);

    const validated: ValidatedOpenMat = {
      gym_id: gymId,
      day_of_week: item.day_of_week,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      type,
      recurring: item.recurring,
      specific_date: item.specific_date ?? null,
      age_policy: agePolicy,
      source_type: sourceType,
      source_url: sourceUrl,
      last_source_check: now,
      needs_review: sourceType !== 'website_scrape',
      confidence_score: sourceType === 'website_scrape' ? 'medium' : 'low',
      freshness_status: 'likely_current',
      confirmation_method: sourceType === 'google_search' ? 'social_media' : 'website_scrape',
      // AI-enriched fields
      visitor_access: visitorAccess,
      advance_contact_required: item.advance_contact_required ?? undefined,
      contact_instructions: item.contact_instructions ?? undefined,
      coaching_present: coachingPresent,
      intensity,
      beginner_friendly: beginnerFriendly,
      women_presence: womenPresence,
      competition_focused: item.competition_focused ?? undefined,
      uniform_restrictions: item.uniform_restrictions ?? undefined,
      notes: item.notes ?? undefined,
      // extraction_notes not in DB schema yet — store in notes if needed
    };

    // Only include drop_in_fee and price if present
    if (dropInFee) {
      validated.drop_in_fee = dropInFee;
      if (dropInFee.amount != null) {
        validated.price = dropInFee.amount;
      }
    }

    results.push(validated);
  }

  return results;
}

// --- Field mapping helpers ---

function castToValid<T extends string>(
  value: string | undefined | null,
  validValues: T[],
  fallback: T
): T {
  if (value && validValues.includes(value as T)) {
    return value as T;
  }
  return fallback;
}

function mapCoachingPresent(value: boolean | null | undefined): CoachingPresence {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return 'unknown';
}

function mapBeginnerFriendly(value: boolean | null | undefined): BeginnerFriendly {
  if (value === true) return 'yes';
  return 'unknown';
}

function mapWomenPresence(value: boolean | undefined): WomenPresence {
  if (value === true) return 'women_specific';
  return 'unknown';
}

function mapDropInFee(
  aiFee: AIExtractedOpenMat['drop_in_fee']
): DropInFee | undefined {
  if (!aiFee) return undefined;
  return {
    free: aiFee.free,
    amount: aiFee.amount ?? undefined,
    first_visit_free: aiFee.first_visit_free ?? undefined,
    unknown: aiFee.unknown,
  };
}

// --- Time helpers ---

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

function detectAgePolicy(className: string): AgePolicy {
  const lower = className.toLowerCase();
  if (lower.includes('kids') || lower.includes('children') || lower.includes('youth') || lower.includes('junior')) {
    return 'kids_separate';
  }
  if (lower.includes('adult')) return 'adults_only';
  return 'unknown';
}

// --- Legacy function (deprecated) ---

/**
 * @deprecated Use `validateAIExtraction` instead. This function handles the old
 * parser-based ExtractedOpenMat[] format and is kept only for backward compatibility.
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
      freshness_status: 'likely_current',
      confirmation_method: 'website_scrape',
    });
  }

  return results;
}

function detectMatType(className: string): MartialArtType {
  const lower = className.toLowerCase();
  if (lower.includes('no-gi') || lower.includes('nogi') || lower.includes('no gi')) return 'nogi';
  if (/\bgi\b/.test(lower) && !lower.includes('no')) return 'gi';
  return 'both';
}

function mapConfidence(parserConfidence: number): ConfidenceLevel {
  if (parserConfidence >= 0.7) return 'medium';
  if (parserConfidence >= 0.4) return 'low';
  return 'unverified';
}
