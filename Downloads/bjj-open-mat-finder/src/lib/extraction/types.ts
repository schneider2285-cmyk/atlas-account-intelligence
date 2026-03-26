import type {
  ConfidenceLevel, ConfirmationMethod, FreshnessStatus,
  MartialArtType, AgePolicy, VisitorAccess, IntensityLevel,
  WomenPresence, CoachingPresence, BeginnerFriendly, DropInFee,
} from '@/lib/types';

// --- Pipeline Stage Results ---

export interface FetchResult {
  html: string;
  statusCode: number;
  finalUrl: string;
}

export interface ScheduleDiscoveryResult {
  scheduleUrl: string;
  scheduleHtml: string;
  isHomepageFallback?: boolean;
}

// --- AI Extraction Types ---

export interface AIExtractedOpenMat {
  class_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string | null;
  type: 'gi' | 'nogi' | 'both' | 'unknown';
  recurring: boolean;
  specific_date?: string | null;
  drop_in_fee?: {
    free: boolean;
    amount?: number | null;
    first_visit_free?: boolean | null;
    unknown: boolean;
  };
  visitor_access?: string;
  advance_contact_required?: boolean | null;
  contact_instructions?: string | null;
  coaching_present?: boolean | null;
  intensity?: string;
  beginner_friendly?: boolean | null;
  women_only?: boolean;
  competition_focused?: boolean | null;
  uniform_restrictions?: string | null;
  notes?: string | null;
}

export interface AIExtractionResult {
  openMats: AIExtractedOpenMat[];
  schedulePageFound: boolean;
  confidenceNote: string | null;
  tokensUsed: { input: number; output: number };
  isScreenshot?: boolean;
}

// --- Legacy parser types (deprecated, kept for reference) ---

export interface DetectionResult {
  detected: boolean;
  confidence: number;
  signals: string[];
}

export interface PlatformDetectionResult {
  platform: string;
  parserName: string;
  confidence: number;
}

export interface ExtractedOpenMat {
  className: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string | null;
  rawText: string;
}

export interface ScheduleParser {
  name: string;
  detect(html: string): DetectionResult;
  extract(html: string): ExtractedOpenMat[];
}

// --- Validated output (ready for DB) ---

export interface ValidatedOpenMat {
  gym_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  type: MartialArtType;
  recurring: boolean;
  specific_date?: string | null;
  age_policy: AgePolicy;
  source_type: 'website_scrape' | 'image_ocr' | 'google_search';
  source_url: string;
  last_source_check: string;
  needs_review: boolean;
  confidence_score: ConfidenceLevel;
  freshness_status: FreshnessStatus;
  confirmation_method: ConfirmationMethod;
  // AI-enriched fields
  price?: number;
  drop_in_fee?: DropInFee;
  visitor_access?: VisitorAccess;
  advance_contact_required?: boolean;
  contact_instructions?: string;
  coaching_present?: CoachingPresence;
  intensity?: IntensityLevel;
  beginner_friendly?: BeginnerFriendly;
  women_presence?: WomenPresence;
  competition_focused?: boolean;
  uniform_restrictions?: string;
  notes?: string;
}

// --- Pipeline Result ---

export type PipelineStage =
  | 'fetch'
  | 'discover_schedule'
  | 'clean_html'
  | 'ai_extract'
  | 'screenshot_fallback'
  | 'validate'
  | 'save';

export interface PipelineResult {
  gymId: string;
  gymName: string;
  success: boolean;
  stage: PipelineStage;
  error?: string;
  scheduleUrl?: string;
  platform?: string;
  extractedCount: number;
  savedCount: number;
  openMats: ValidatedOpenMat[];
  tokensUsed?: { input: number; output: number };
}
