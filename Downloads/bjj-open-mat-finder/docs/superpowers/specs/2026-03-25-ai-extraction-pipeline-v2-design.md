# AI-First Open Mat Extraction Pipeline v2

## Problem

The current extraction pipeline discovers open mat data for ~25-40% of gyms with websites. The remaining 60-75% fail due to:

1. **Keyword matching too narrow** (5 hardcoded terms miss "Rolling Session", "Mat Time", "Casual Rolls", etc.)
2. **Time parsing too rigid** (regex fails on "12-2 PM", "Noon to 2", "to" instead of "-")
3. **Platform detection brittle** (4 parsers totaling 1,000+ lines cover only Kicksite, Zen Planner, MindBody, and generic HTML)
4. **No JS rendering** (`fetch()` gets empty HTML shell for SPA-based gym sites)
5. **No image/PDF support** (many gyms post Canva-designed schedule images)
6. **Schedule discovery too limited** (6 URL conventions, 5 link keywords)

Most BJJ gyms have open mat sessions. The tool is useless without this data.

## Solution

Replace the rule-based parser layer (Stages 3-4) with Claude Haiku API calls. Claude understands BJJ terminology, handles any time format, and extracts richer metadata (visitor access, drop-in fees, gi/nogi) that regex parsers never could.

For JS-rendered and image-based schedules, add a Playwright screenshot fallback that sends the visual to Claude Vision.

### Cost Model

| Scenario | Per gym | 3,000 gyms |
|----------|---------|------------|
| HTML to Haiku (standard) | ~$0.007 | ~$21 |
| Hybrid (rule-based first, AI fallback) + Batch API | ~$0.0025 | ~$7.50 |
| Quarterly refresh (3K gyms, hybrid+batch) | | ~$30/year |

## Architecture

### Pipeline Flow

```
Stage 1: Fetch Homepage (improved: retry, relaxed content-type)
    ↓
Stage 2: Discover Schedule URL (expanded: 16 URL paths, 10 link keywords)
    ↓
Stage 3: Clean HTML (new: strip to schedule-relevant content, target <5K tokens)
    ↓
Stage 4: Claude Haiku Extraction (new: replaces all 4 parsers)
    ↓
    ↓ (if Stage 2 found no schedule page OR Stage 4 returned 0 results)
    ↓
Stage 4b: Playwright Screenshot → Claude Vision (new: JS/image/PDF fallback)
    ↓
Stage 5: Validate & Normalize (updated: accept AI-enriched fields)
    ↓
Stage 6: Save to Database (unchanged)
```

### Decision: Why AI-First, Not AI-as-Fallback

Running rule-based parsers first and falling back to AI would save a few dollars but adds complexity (two code paths, maintenance of 1,000+ lines of parser code that handles the minority of cases). The AI path handles everything the parsers handle AND the 60-75% they miss. The parsers become dead weight.

**Exception:** We keep the rule-based parsers in the codebase (deprecated, not wired into pipeline) as reference. They can be re-enabled if needed.

## Detailed Stage Design

### Stage 1: Fetch (`fetch.ts` — updated)

Changes from current:
- Add 1 retry with 3-second delay on failure
- Accept empty/missing content-type (some gym sites misconfigure headers)
- Accept `application/xhtml+xml`
- Log the failure reason (timeout, DNS, HTTP status) instead of silent `null`

```typescript
interface FetchResult {
  html: string;
  statusCode: number;
  finalUrl: string;
}

// Returns null only after retry exhausted
async function fetchPage(url: string): Promise<FetchResult | null>
```

### Stage 2: Discover Schedule URL (`discover-schedule.ts` — expanded)

**Convention paths** (6 → 16):
```typescript
const CONVENTION_PATHS = [
  '/schedule', '/class-schedule', '/classes', '/timetable',
  '/programs', '/weekly-schedule',
  // NEW:
  '/open-mat', '/open-mats', '/rolling', '/drop-in',
  '/sessions', '/calendar', '/training', '/events',
  '/adult-schedule', '/mat-times',
];
```

**Link scoring keywords** (5 → 10):
```typescript
const SCHEDULE_LINK_KEYWORDS = [
  'schedule', 'class', 'timetable', 'program', 'calendar',
  // NEW:
  'open mat', 'rolling', 'session', 'training', 'drop-in',
];
```

**New fallback behavior:** If no schedule page found via convention probing or link crawl, return the homepage itself as the schedule candidate. Claude can determine if there's open mat info even on a general page. This eliminates the "No schedule page found" dead end.

```typescript
// Old: return null if nothing found
// New: return homepage as last resort
if (hasScheduleContent(homepageHtml)) {
  return { scheduleUrl: base, scheduleHtml: homepageHtml };
}
// NEW: Even without schedule content signals, return homepage for AI to try
return { scheduleUrl: base, scheduleHtml: homepageHtml, isHomepageFallback: true };
```

### Stage 3: Clean HTML (`clean-html.ts` — new)

Purpose: Strip HTML to minimize tokens sent to Claude while preserving schedule content.

```typescript
function cleanHtmlForAI(html: string): string
```

**Stripping rules:**
1. Remove `<script>`, `<style>`, `<noscript>`, `<svg>`, `<path>` tags and contents
2. Remove `<nav>`, `<footer>`, `<header>` — BUT only if they do NOT contain schedule keywords ("open mat", "schedule", day names). Many small gym sites embed schedule content in these elements.
3. Remove all HTML attributes except: `class`, `id`, `href`
4. Remove HTML comments
5. Remove empty elements (no text content, no children with text)
6. Collapse consecutive whitespace to single space
7. Collapse consecutive newlines to single newline

**Token budget:** If cleaned HTML exceeds ~15,000 tokens (~60KB text), extract only the section containing the most day-name references (Monday-Sunday) within a 5,000-token window.

**Output:** Clean text/HTML string, typically 2,000-5,000 tokens.

### Stage 4: Claude Haiku Extraction (`ai-extract.ts` — new)

**Dependencies:** `@anthropic-ai/sdk`

**Environment:** `ANTHROPIC_API_KEY` env var

**System prompt** (cached across all calls):

```
You are a BJJ (Brazilian Jiu-Jitsu) gym schedule data extractor.

Given the HTML content of a BJJ gym's website or schedule page, extract ALL open mat sessions.

## What is an open mat?
An open mat is a session where practitioners can come and roll (spar/grapple) freely —
not a structured class with a specific curriculum. Open mats may or may not have a coach present.

## Common names for open mats
Open Mat, Open Roll, Free Roll, Free Rolling, Rolling, Mat Time, Casual Rolls,
Open Training, Sparring, Live Training, Free Training, Open Rolling, Freestyle Rolling,
Submission Wrestling, Open Gym, Roll Time, Grappling, Open Sparring, Live Rolling,
Saturday/Sunday Roll, Weekend Roll, Lunch Roll, Morning Roll,
Women's Open Mat, Ladies Roll, Women's Only, Girls Roll.

## What is NOT an open mat
Regular classes (Fundamentals, Basics, Advanced, Beginner), Kids classes,
Competition Team practice (unless explicitly open to visitors), Private lessons,
Yoga/Conditioning/Strength classes, Seminars, Belt promotions,
Open Enrollment/Registration/Open House events.

## What to extract
For each open mat session found, provide:
- The name as listed on the schedule
- Day of week (0=Sunday through 6=Saturday)
- Start time in 24h HH:MM format
- End time in 24h HH:MM format (null if not listed)
- Type: "gi", "nogi", "both", or "unknown"
- Whether it is a recurring weekly session or a one-off event
- Drop-in fee: is it free? If paid, how much in USD? Is first visit free? If unknown, say so.
- Visitor access: "open_to_all", "contact_first", "members_only", or "unknown"
- Whether advance contact is required, and if so, the contact instructions
- Whether a coach is present/supervising
- Intensity: "casual" (all levels), "moderate", "competition" (competition-focused), "varies", or "unknown"
- Whether the session is beginner-friendly
- Whether the session is women-specific (e.g., "Women's Open Mat", "Ladies Roll")
- Any uniform restrictions mentioned (e.g., "white gi only", "no-gi only")
- Any other relevant notes (e.g., "bring mouthguard", "all levels welcome")

If the page contains no open mat sessions, return an empty array.
If you are uncertain whether something is an open mat, include it with a note explaining the uncertainty.
```

**API call structure:**

```typescript
const response = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  system: SYSTEM_PROMPT,  // cached
  messages: [
    { role: 'user', content: cleanedHtml }
  ],
  tools: [{
    name: 'report_open_mats',
    description: 'Report extracted open mat sessions from the schedule',
    input_schema: {
      type: 'object',
      properties: {
        open_mats: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              class_name: { type: 'string' },
              day_of_week: { type: 'integer', minimum: 0, maximum: 6 },
              start_time: { type: 'string', pattern: '^[0-2][0-9]:[0-5][0-9]$' },
              end_time: { type: ['string', 'null'] },
              type: { type: 'string', enum: ['gi', 'nogi', 'both', 'unknown'] },
              recurring: { type: 'boolean', description: 'true if weekly recurring, false if one-off event' },
              specific_date: { type: ['string', 'null'], description: 'ISO date if one-off event, null if recurring' },
              drop_in_fee: {
                type: 'object',
                properties: {
                  free: { type: 'boolean' },
                  amount: { type: ['number', 'null'], description: 'USD amount, null if unknown' },
                  first_visit_free: { type: ['boolean', 'null'], description: 'null if unknown' },
                  unknown: { type: 'boolean', description: 'true if fee info not found on page' }
                },
                required: ['free', 'unknown']
              },
              visitor_access: { type: 'string', enum: ['open_to_all', 'contact_first', 'members_only', 'unknown'] },
              advance_contact_required: { type: ['boolean', 'null'] },
              contact_instructions: { type: ['string', 'null'] },
              coaching_present: { type: ['boolean', 'null'], description: 'null if unknown' },
              intensity: { type: 'string', enum: ['casual', 'moderate', 'competition', 'varies', 'unknown'] },
              beginner_friendly: { type: ['boolean', 'null'], description: 'null if unknown' },
              women_only: { type: 'boolean', description: 'true if women-specific session' },
              competition_focused: { type: ['boolean', 'null'] },
              uniform_restrictions: { type: ['string', 'null'] },
              notes: { type: ['string', 'null'] }
            },
            required: ['class_name', 'day_of_week', 'start_time', 'end_time', 'type', 'recurring', 'women_only']
          }
        },
        schedule_page_found: { type: 'boolean' },
        confidence_note: { type: ['string', 'null'], description: 'Any caveats about extraction quality — persisted for human reviewers' }
      },
      required: ['open_mats', 'schedule_page_found']
    }
  }],
  tool_choice: { type: 'tool', name: 'report_open_mats' }
});
```

**Using `tool_use` with `tool_choice: { type: 'tool' }`** forces Claude to respond with structured JSON matching the schema — no free-text parsing needed.

**Response parsing:**

```typescript
interface AIExtractionResult {
  openMats: ExtractedOpenMat[];  // Mapped to existing type
  schedulePageFound: boolean;     // Did the page actually contain a schedule?
  confidenceNote: string | null;  // Any caveats from Claude
  tokensUsed: { input: number; output: number };
}
```

**Error handling:**
- API timeout (30s) → return empty result, log error
- Rate limit (429) → exponential backoff, max 3 retries
- Invalid JSON from tool_use → should not happen (schema-enforced), but log and return empty
- API key missing → throw immediately with clear error message

### Stage 4b: Playwright Screenshot Fallback (`screenshot.ts` — new)

**When triggered:**
1. Stage 2 found no schedule page AND homepage fallback returned 0 results from AI
2. OR Stage 4 returned `schedulePageFound: false` (AI saw no schedule in the HTML)

**Dependencies:** `playwright` (chromium only)

**Implementation:**

```typescript
async function captureScheduleScreenshot(url: string): Promise<Buffer | null> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 2000 } });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });

  // Scroll to trigger lazy-loaded content
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
  await browser.close();

  return screenshot;
}
```

**Sending to Claude Vision:**

```typescript
const response = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  system: SYSTEM_PROMPT,  // same prompt, cached
  messages: [{
    role: 'user',
    content: [
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: screenshotBase64 }
      },
      {
        type: 'text',
        text: 'This is a screenshot of a BJJ gym website. Extract any open mat sessions you can find.'
      }
    ]
  }],
  tools: [/* same tool schema */],
  tool_choice: { type: 'tool', name: 'report_open_mats' }
});
```

**Browser lifecycle management for bulk runs:**
- Launch browser once, reuse across gyms
- New context per gym (clean cookies/cache)
- Close browser after batch completes
- Concurrency limit: 3 pages at a time (avoid memory issues)

### Stage 5: Validate (`validate.ts` — updated)

**Changes:**
- Accept all AI-enriched fields directly (type, drop_in_fee, visitor_access, intensity, women_only, etc.)
- Map AI `type` directly instead of guessing from class name — `'unknown'` maps to `'both'` with `needs_review: true`
- Set confidence to `low` for HTML-based AI extraction, `unverified` for screenshot-based (per North Star: website scrapes rank below community reports)
- Set `freshness_status` to `'likely_current'` for HTML, `'unverified'` for screenshot
- Set `source_type` to `'website_scrape'` for HTML path, `'image_ocr'` for screenshot path
- Persist `confidence_note` from AI into `extraction_notes` field for human reviewers
- Remove `detectMatType()` and `detectAgePolicy()` (AI provides these directly)
- Keep `isReasonableTime()` filter but widen to 5:00-23:59

**Updated ExtractedOpenMat type:**

```typescript
interface ExtractedOpenMat {
  className: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string | null;
  rawText: string;
  // NEW from AI — all optional, AI populates what it can:
  type?: MartialArtType;
  recurring?: boolean;
  specificDate?: string | null;
  dropInFee?: { free: boolean; amount: number | null; firstVisitFree: boolean | null; unknown: boolean };
  visitorAccess?: VisitorAccess;
  advanceContactRequired?: boolean | null;
  contactInstructions?: string | null;
  coachingPresent?: boolean | null;
  intensity?: IntensityLevel;
  beginnerFriendly?: boolean | null;
  womenOnly?: boolean;
  competitionFocused?: boolean | null;
  uniformRestrictions?: string | null;
  notes?: string | null;
}
```

**Updated ValidatedOpenMat type:**

```typescript
interface ValidatedOpenMat {
  gym_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  type: MartialArtType;
  recurring: boolean;
  specific_date?: string | null;
  age_policy: AgePolicy;
  source_type: 'website_scrape' | 'image_ocr';
  source_url: string;
  last_source_check: string;
  needs_review: boolean;
  confidence_score: ConfidenceLevel;
  freshness_status: FreshnessStatus;
  confirmation_method: ConfirmationMethod;
  // NEW — AI-enriched:
  price?: number;
  drop_in_fee_free?: boolean;
  first_visit_free?: boolean | null;
  visitor_access?: VisitorAccess;
  advance_contact_required?: boolean;
  contact_instructions?: string;
  coaching_present?: boolean | null;
  intensity?: IntensityLevel;
  beginner_friendly?: boolean | null;
  women_presence?: WomenPresence;  // 'women_specific' if womenOnly, else 'unknown'
  competition_focused?: boolean | null;
  uniform_restrictions?: string;
  notes?: string;
  extraction_notes?: string;  // AI confidence_note — persisted for human reviewers
}
```

### Updated Pipeline Orchestrator (`pipeline.ts`)

**Updated PipelineStage enum:**
```typescript
type PipelineStage =
  | 'fetch'
  | 'discover_schedule'
  | 'clean_html'
  | 'ai_extract'
  | 'screenshot_fallback'
  | 'validate'
  | 'save';
```

```typescript
async function runExtractionPipeline(options: PipelineOptions): Promise<PipelineResult> {
  // Stage 1: Fetch homepage (with retry)
  const homepage = await fetchPage(websiteUrl);
  if (!homepage) { return error('fetch', `Failed to fetch ${websiteUrl}`); }

  // Stage 2: Discover schedule URL (expanded paths + keywords)
  const schedule = await discoverScheduleUrl(websiteUrl, homepage.html);
  // schedule is never null now — falls back to homepage

  // Stage 3: Clean HTML
  result.stage = 'clean_html';
  const cleanedHtml = cleanHtmlForAI(schedule.scheduleHtml);

  // Stage 4: Claude Haiku extraction
  result.stage = 'ai_extract';
  const aiResult = await extractWithAI(cleanedHtml);
  result.tokensUsed = aiResult.tokensUsed;

  // Stage 4b: Screenshot fallback if AI found nothing
  if (aiResult.openMats.length === 0 && !aiResult.schedulePageFound) {
    result.stage = 'screenshot_fallback';
    const screenshot = await captureScheduleScreenshot(schedule.scheduleUrl);
    if (screenshot) {
      const visionResult = await extractWithAIVision(screenshot);
      aiResult.openMats = visionResult.openMats;
      aiResult.isScreenshot = true;
      result.tokensUsed.input += visionResult.tokensUsed.input;
      result.tokensUsed.output += visionResult.tokensUsed.output;
    }
  }

  // Stage 5: Validate & normalize
  result.stage = 'validate';
  const sourceType = aiResult.isScreenshot ? 'image_ocr' : 'website_scrape';
  const validated = validateAndNormalize(
    aiResult.openMats, gymId, schedule.scheduleUrl, sourceType,
    aiResult.confidenceNote, needsReview
  );

  return { success: true, openMats: validated, ... };
}
```

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/lib/extraction/pipeline.ts` | **Rewrite** | New flow: fetch → discover → clean → AI → screenshot fallback → validate |
| `src/lib/extraction/fetch.ts` | **Update** | Add retry, relax content-type check |
| `src/lib/extraction/discover-schedule.ts` | **Update** | 16 URL paths, 10 link keywords, homepage fallback always returns |
| `src/lib/extraction/clean-html.ts` | **Create** | HTML stripping for token reduction |
| `src/lib/extraction/ai-extract.ts` | **Create** | Claude Haiku API call with tool_use schema |
| `src/lib/extraction/screenshot.ts` | **Create** | Playwright screenshot capture |
| `src/lib/extraction/validate.ts` | **Update** | Accept AI-enriched fields (type, fee, visitor access) |
| `src/lib/extraction/types.ts` | **Update** | Add AI extraction fields to types |
| `src/lib/extraction/detect-platform.ts` | **Deprecate** | No longer called from pipeline |
| `src/lib/extraction/parsers/` | **Deprecate** | All 4 parsers kept for reference, not wired in |
| `scripts/extract-all.ts` | **Update** | Add batch API support, browser lifecycle management |
| `scripts/extract-gym.ts` | **Update** | Use new pipeline |
| `.env.example` | **Update** | Add ANTHROPIC_API_KEY |
| `package.json` | **Update** | Add @anthropic-ai/sdk, playwright deps |

## New Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `@anthropic-ai/sdk` | Claude API calls | ~50KB |
| `playwright` | Headless Chrome for screenshot fallback | ~200MB install, but only chromium |

**Note:** Playwright is heavy. For the Vercel deployment (admin panel), the screenshot fallback would only work from local scripts, not from the API route. The HTML→AI path works everywhere.

## Environment Variables

```
# Existing
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_PLACES_API_KEY=...

# New
ANTHROPIC_API_KEY=...
```

## Testing Strategy

1. **Unit tests for `clean-html.ts`** — verify stripping works correctly
2. **Unit tests for `ai-extract.ts`** — mock the API, test response parsing and error handling
3. **Integration test** — run against 5 known gyms with different schedule formats:
   - Kicksite gym (Carlson Gracie) — verify AI matches rule-based parser output
   - Image-based schedule gym — verify screenshot fallback works
   - JS-rendered gym — verify screenshot fallback works
   - Gym with "Rolling Session" terminology — verify AI catches it
   - Gym with no schedule — verify clean empty result

## Expected Outcome

| Metric | Current | After v2 |
|--------|---------|----------|
| Extraction success rate | ~25-40% | ~85-90% |
| Open mat data fields | day, time, type (guessed) | day, time, type, fee, visitor access, notes |
| Parsers to maintain | 4 (1,000+ lines) | 1 prompt (~500 words) |
| Cost per gym | $0 | ~$0.007 (Haiku) |
| Cost for 3,000 gyms | $0 | ~$15-21 |

## Cost Controls & Safety

### Bulk Run Guards (`extract-all.ts`)
- `--max-cost <dollars>` flag (default: $25) — tracks cumulative token usage, halts batch when budget reached
- `--dry-run` flag — runs stages 1-3 (fetch, discover, clean) but logs what would be sent to AI without making API calls. Useful for estimating token counts.
- `--skip-screenshot` flag — skip Playwright fallback (HTML-only extraction, cheaper/faster)
- `--skip-fresh <days>` flag (default: 30) — skip gyms scraped within N days unless `--force`
- Token usage tracking: each pipeline result includes `tokensUsed: { input, output }`, batch script accumulates and reports total

### Playwright Safety
- `captureScheduleScreenshot()` uses try/finally to ensure browser closes on error
- For bulk runs: launch browser once, create new context per gym, close browser in finally block wrapping entire batch
- Concurrency limit: 3 pages at a time (avoid memory exhaustion)
- 15s timeout per page load — if exceeded, skip screenshot for that gym
