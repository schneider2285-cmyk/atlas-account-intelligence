import { fetchPage } from './fetch';
import { discoverScheduleUrl } from './discover-schedule';
import { cleanHtmlForAI } from './clean-html';
import { extractWithAI, extractWithAIVision } from './ai-extract';
import { captureScheduleScreenshot } from './screenshot';
import { searchAndExtractOpenMats } from './google-search';
import { validateAIExtraction } from './validate';
import type { PipelineResult, PipelineStage } from './types';

interface PipelineOptions {
  gymId: string;
  gymName: string;
  websiteUrl: string;
  needsReview?: boolean;
  enableScreenshot?: boolean; // default false - requires playwright
  enableGoogleSearch?: boolean; // default false - requires SERPER_API_KEY or GOOGLE_SEARCH_ENGINE_ID
}

/**
 * AI-first extraction pipeline orchestrator.
 * Runs stages sequentially for a single gym:
 *   fetch → discover schedule → clean HTML → AI extract → (screenshot fallback) → validate
 * Returns results (including extracted open mats) without saving to DB.
 * Stage 'save' is handled by the caller (API route or bulk script).
 */
export async function runExtractionPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const { gymId, gymName, websiteUrl, needsReview = false, enableScreenshot = false, enableGoogleSearch = false } = options;

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
  console.log(`[Pipeline] ${gymName}: Fetching homepage...`);
  const homepage = await fetchPage(websiteUrl);
  if (!homepage) {
    result.error = `Failed to fetch ${websiteUrl}`;
    return result;
  }

  // Stage 2: Discover schedule URL
  result.stage = 'discover_schedule';
  console.log(`[Pipeline] ${gymName}: Discovering schedule page...`);
  const schedule = await discoverScheduleUrl(websiteUrl, homepage.html);
  result.scheduleUrl = schedule.scheduleUrl;

  if (schedule.isHomepageFallback) {
    console.log(`[Pipeline] ${gymName}: No dedicated schedule page found, using homepage as fallback`);
  }

  // Stage 3: Clean HTML for AI consumption
  result.stage = 'clean_html';
  console.log(`[Pipeline] ${gymName}: Cleaning HTML for AI extraction...`);
  const cleanedHtml = cleanHtmlForAI(schedule.scheduleHtml);

  if (!cleanedHtml) {
    result.error = 'Cleaned HTML is empty — no extractable content found';
    return result;
  }

  // Stage 4: AI extraction
  result.stage = 'ai_extract';
  console.log(`[Pipeline] ${gymName}: Running AI extraction...`);
  let aiResult = await extractWithAI(cleanedHtml);
  let tokensUsed = { ...aiResult.tokensUsed };
  let isScreenshot = false;
  let isGoogleSearch = false;

  // Stage 5: Screenshot fallback (if AI found no schedule and screenshots enabled)
  if (!aiResult.schedulePageFound && enableScreenshot) {
    result.stage = 'screenshot_fallback';
    console.log(`[Pipeline] ${gymName}: AI found no schedule, attempting screenshot fallback...`);

    const screenshot = await captureScheduleScreenshot(schedule.scheduleUrl);

    if (screenshot) {
      console.log(`[Pipeline] ${gymName}: Screenshot captured, running vision extraction...`);
      const visionResult = await extractWithAIVision(screenshot);
      aiResult = visionResult;
      isScreenshot = true;

      // Accumulate tokens from both text and vision extractions
      tokensUsed.input += visionResult.tokensUsed.input;
      tokensUsed.output += visionResult.tokensUsed.output;
    } else {
      console.log(`[Pipeline] ${gymName}: Screenshot capture failed`);
    }
  }

  // Stage 5b: Google search fallback (if no open mats found and search enabled)
  if (aiResult.openMats.length === 0 && enableGoogleSearch) {
    console.log(`[Pipeline] ${gymName}: No open mats from website, trying Google search...`);
    const searchResult = await searchAndExtractOpenMats(gymName);
    tokensUsed.input += searchResult.tokensUsed.input;
    tokensUsed.output += searchResult.tokensUsed.output;

    if (searchResult.openMats.length > 0) {
      isGoogleSearch = true;
      console.log(`[Pipeline] ${gymName}: Google search found ${searchResult.openMats.length} open mats!`);
      aiResult = {
        ...aiResult,
        openMats: searchResult.openMats,
        schedulePageFound: true,
        confidenceNote: searchResult.confidenceNote,
      };
    }
  }

  result.tokensUsed = tokensUsed;
  result.extractedCount = aiResult.openMats.length;

  if (aiResult.openMats.length === 0) {
    result.error = aiResult.schedulePageFound
      ? 'Schedule found but no open mats detected'
      : 'No schedule content found on page';
    result.success = true;
    result.stage = 'save';
    return result;
  }

  // Stage 6: Validate & normalize AI output
  result.stage = 'validate';
  console.log(`[Pipeline] ${gymName}: Validating ${aiResult.openMats.length} extracted open mats...`);
  const sourceUrl = schedule.scheduleUrl;
  const sourceType = isScreenshot ? 'image_ocr' as const
    : isGoogleSearch ? 'google_search' as const
    : 'website_scrape' as const;
  const validated = validateAIExtraction(
    aiResult.openMats,
    gymId,
    sourceUrl,
    sourceType,
    aiResult.confidenceNote,
  );

  result.openMats = validated;
  result.success = true;
  result.stage = 'save';

  console.log(`[Pipeline] ${gymName}: Complete — ${validated.length} open mats validated`);

  return result;
}
