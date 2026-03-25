import { fetchPage } from './fetch';
import { discoverScheduleUrl } from './discover-schedule';
import { detectPlatform, getParser } from './detect-platform';
import { validateAndNormalize } from './validate';
import type { PipelineResult, ValidatedOpenMat } from './types';

interface PipelineOptions {
  gymId: string;
  gymName: string;
  websiteUrl: string;
  needsReview: boolean;
}

/**
 * Main extraction pipeline orchestrator.
 * Runs stages 1-5 sequentially for a single gym.
 * Returns results (including extracted open mats) without saving to DB.
 * Stage 6 (save) is handled by the caller (API route or bulk script).
 */
export async function runExtractionPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const { gymId, gymName, websiteUrl, needsReview } = options;

  const result: PipelineResult = {
    gymId,
    gymName,
    success: false,
    stage: 'fetch',
    extractedCount: 0,
    savedCount: 0,
    openMats: [],
  };

  // Stage 1: Fetch homepage
  const homepage = await fetchPage(websiteUrl);
  if (!homepage) {
    result.error = `Failed to fetch ${websiteUrl}`;
    return result;
  }

  // Stage 2: Discover schedule URL
  result.stage = 'discover_schedule';
  const schedule = await discoverScheduleUrl(websiteUrl, homepage.html);
  if (!schedule) {
    result.error = 'No schedule page found';
    return result;
  }
  result.scheduleUrl = schedule.scheduleUrl;

  // Stage 3: Detect platform
  result.stage = 'detect_platform';
  const platform = detectPlatform(schedule.scheduleHtml);
  if (!platform) {
    result.error = 'No parser matched this schedule format';
    result.platform = 'unknown';
    return result;
  }
  result.platform = platform.platform;

  // Stage 4: Extract open mats
  result.stage = 'extract';
  const parser = getParser(platform.parserName);
  if (!parser) {
    result.error = `Parser ${platform.parserName} not found in registry`;
    return result;
  }

  const extracted = parser.extract(schedule.scheduleHtml);
  result.extractedCount = extracted.length;

  if (extracted.length === 0) {
    result.error = 'Schedule found but no open mats detected';
    result.success = true;
    return result;
  }

  // Stage 5: Validate & normalize
  result.stage = 'validate';
  const validated = validateAndNormalize(
    extracted,
    gymId,
    schedule.scheduleUrl,
    platform.confidence,
    needsReview
  );

  result.openMats = validated;
  result.success = true;
  result.stage = 'save';

  return result;
}
