import type { ConfidenceLevel, ConfirmationMethod, MartialArtType, AgePolicy } from '@/lib/types';

// --- Pipeline Stage Results ---

export interface FetchResult {
  html: string;
  statusCode: number;
  finalUrl: string;
}

export interface ScheduleDiscoveryResult {
  scheduleUrl: string;
  scheduleHtml: string;
}

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

// --- Parser Interface ---

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
  age_policy: AgePolicy;
  source_type: 'website_scrape';
  source_url: string;
  last_source_check: string;
  needs_review: boolean;
  confidence_score: ConfidenceLevel;
  confirmation_method: ConfirmationMethod;
}

// --- Pipeline Result ---

export type PipelineStage =
  | 'fetch'
  | 'discover_schedule'
  | 'detect_platform'
  | 'extract'
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
}
