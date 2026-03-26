# AI-First Open Mat Extraction Pipeline v2 — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace rule-based parsers with Claude Haiku API extraction to increase open mat discovery from ~30% to ~85-90% of gyms.

**Architecture:** New pipeline: Fetch (with retry) → Discover Schedule (expanded) → Clean HTML → Claude Haiku API (tool_use) → Playwright Screenshot fallback → Validate → Save. The AI replaces 4 brittle parsers (1,000+ lines) with a single structured prompt.

**Tech Stack:** @anthropic-ai/sdk (Claude Haiku API), playwright (screenshot fallback), cheerio (HTML cleaning), existing Next.js + Supabase stack.

**Spec:** `docs/superpowers/specs/2026-03-25-ai-extraction-pipeline-v2-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/extraction/types.ts` | Modify | Add AI extraction fields to ExtractedOpenMat, update ValidatedOpenMat, update PipelineStage enum |
| `src/lib/extraction/fetch.ts` | Modify | Add retry logic, relax content-type check |
| `src/lib/extraction/discover-schedule.ts` | Modify | Expand to 16 URL paths, 10 link keywords, always-return homepage fallback |
| `src/lib/extraction/clean-html.ts` | Create | Strip HTML for AI consumption (remove scripts/styles, preserve schedule content) |
| `src/lib/extraction/ai-extract.ts` | Create | Claude Haiku API call with tool_use schema, response parsing |
| `src/lib/extraction/screenshot.ts` | Create | Playwright screenshot capture for JS/image schedule fallback |
| `src/lib/extraction/validate.ts` | Modify | Accept AI-enriched fields, map source_type correctly, set freshness_status |
| `src/lib/extraction/pipeline.ts` | Rewrite | New orchestrator: fetch → discover → clean → AI → screenshot fallback → validate |
| `src/lib/extraction/__tests__/clean-html.test.ts` | Create | Tests for HTML cleaning |
| `src/lib/extraction/__tests__/ai-extract.test.ts` | Create | Tests for AI extraction with mocked API |
| `scripts/extract-all.ts` | Modify | Add --max-cost, --dry-run, --skip-screenshot flags, token tracking |
| `scripts/extract-gym.ts` | Modify | Use new pipeline |
| `.env.example` | Modify | Add ANTHROPIC_API_KEY |
| `package.json` | Modify | Add @anthropic-ai/sdk, playwright deps |

---

## Chunk 1: Foundation — Types, Dependencies, HTML Cleaning

### Task 1: Install dependencies and add env var

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `.env.local` (user must add their key)

- [ ] **Step 1: Install @anthropic-ai/sdk**

```bash
cd /Users/matthewschneider/Downloads/bjj-open-mat-finder && npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Install playwright as dev dependency (chromium only)**

```bash
cd /Users/matthewschneider/Downloads/bjj-open-mat-finder && npm install -D playwright
npx playwright install chromium
```

- [ ] **Step 3: Add ANTHROPIC_API_KEY to .env.example**

In `.env.example`, add after the SUPABASE_SERVICE_ROLE_KEY section:

```
# Anthropic API Key (for AI-powered schedule extraction)
# Get this from: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add @anthropic-ai/sdk and playwright dependencies"
```

---

### Task 2: Update extraction types

**Files:**
- Modify: `src/lib/extraction/types.ts`

- [ ] **Step 1: Update PipelineStage and ExtractedOpenMat types**

Replace the full contents of `src/lib/extraction/types.ts` with:

```typescript
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
  source_type: 'website_scrape' | 'image_ocr';
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
  extraction_notes?: string;
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
```

- [ ] **Step 2: Verify types compile**

```bash
cd /Users/matthewschneider/Downloads/bjj-open-mat-finder && npx tsc --noEmit --pretty 2>&1 | head -30
```

There will be errors in files that import from types.ts — that's expected, we'll fix them in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/extraction/types.ts
git commit -m "feat: update extraction types for AI pipeline v2"
```

---

### Task 3: Create HTML cleaning module

**Files:**
- Create: `src/lib/extraction/clean-html.ts`
- Create: `src/lib/extraction/__tests__/clean-html.test.ts`

- [ ] **Step 1: Write the test file**

Create `src/lib/extraction/__tests__/clean-html.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { cleanHtmlForAI } from '../clean-html';

describe('cleanHtmlForAI', () => {
  it('removes script tags and contents', () => {
    const html = '<html><body><p>Schedule</p><script>alert("x")</script></body></html>';
    const result = cleanHtmlForAI(html);
    expect(result).not.toContain('script');
    expect(result).not.toContain('alert');
    expect(result).toContain('Schedule');
  });

  it('removes style tags and contents', () => {
    const html = '<html><body><p>Monday</p><style>.foo{color:red}</style></body></html>';
    const result = cleanHtmlForAI(html);
    expect(result).not.toContain('style');
    expect(result).not.toContain('color');
    expect(result).toContain('Monday');
  });

  it('removes nav/footer/header when they lack schedule keywords', () => {
    const html = `<html><body>
      <header><a href="/">Logo</a></header>
      <main><p>Monday Open Mat 12:00 PM</p></main>
      <footer>Copyright 2026</footer>
    </body></html>`;
    const result = cleanHtmlForAI(html);
    expect(result).not.toContain('Logo');
    expect(result).not.toContain('Copyright');
    expect(result).toContain('Monday Open Mat');
  });

  it('preserves nav/footer/header when they contain schedule keywords', () => {
    const html = `<html><body>
      <header><a href="/schedule">Schedule</a></header>
      <footer><p>Saturday Open Mat 10:00 AM</p></footer>
    </body></html>`;
    const result = cleanHtmlForAI(html);
    expect(result).toContain('Schedule');
    expect(result).toContain('Saturday Open Mat');
  });

  it('strips most HTML attributes but keeps class and id', () => {
    const html = '<div class="schedule" id="main" style="color:red" data-foo="bar"><p>Monday</p></div>';
    const result = cleanHtmlForAI(html);
    expect(result).toContain('class="schedule"');
    expect(result).toContain('id="main"');
    expect(result).not.toContain('style=');
    expect(result).not.toContain('data-foo');
  });

  it('collapses whitespace', () => {
    const html = '<html><body><p>Monday     10:00      AM</p></body></html>';
    const result = cleanHtmlForAI(html);
    expect(result).not.toMatch(/\s{3,}/);
  });

  it('removes SVG elements', () => {
    const html = '<html><body><svg><path d="M0,0"/></svg><p>Open Mat</p></body></html>';
    const result = cleanHtmlForAI(html);
    expect(result).not.toContain('svg');
    expect(result).not.toContain('path');
    expect(result).toContain('Open Mat');
  });

  it('handles empty HTML gracefully', () => {
    expect(cleanHtmlForAI('')).toBe('');
    expect(cleanHtmlForAI('<html></html>')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/matthewschneider/Downloads/bjj-open-mat-finder && npx vitest run src/lib/extraction/__tests__/clean-html.test.ts
```

Expected: FAIL — module `../clean-html` not found.

- [ ] **Step 3: Implement clean-html.ts**

Create `src/lib/extraction/clean-html.ts`:

```typescript
import * as cheerio from 'cheerio';

const SCHEDULE_KEYWORDS = [
  'schedule', 'open mat', 'class', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday', 'sunday', 'rolling', 'training',
];

const REMOVE_TAGS = ['script', 'style', 'noscript', 'svg', 'path', 'iframe'];
const CONDITIONAL_REMOVE_TAGS = ['nav', 'footer', 'header'];
const KEEP_ATTRIBUTES = new Set(['class', 'id', 'href']);

/**
 * Strip HTML down to schedule-relevant content for AI consumption.
 * Target: ~2,000-5,000 tokens output from typical gym website.
 */
export function cleanHtmlForAI(html: string): string {
  if (!html.trim()) return '';

  const $ = cheerio.load(html);

  // Remove always-removed tags
  for (const tag of REMOVE_TAGS) {
    $(tag).remove();
  }

  // Conditionally remove nav/header/footer — only if they don't contain schedule content
  for (const tag of CONDITIONAL_REMOVE_TAGS) {
    $(tag).each((_, el) => {
      const text = $(el).text().toLowerCase();
      const hasScheduleKeyword = SCHEDULE_KEYWORDS.some((kw) => text.includes(kw));
      if (!hasScheduleKeyword) {
        $(el).remove();
      }
    });
  }

  // Remove HTML comments
  $('*').contents().filter(function () {
    return this.type === 'comment';
  }).remove();

  // Strip non-essential attributes
  $('*').each((_, el) => {
    const $el = $(el);
    const attribs = (el as cheerio.Element).attribs;
    if (attribs) {
      for (const attr of Object.keys(attribs)) {
        if (!KEEP_ATTRIBUTES.has(attr)) {
          $el.removeAttr(attr);
        }
      }
    }
  });

  // Get cleaned HTML
  let cleaned = $('body').html() ?? $.html();

  // Collapse whitespace
  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '>\n<')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // If still very large (>60KB ~15K tokens), extract the schedule-dense section
  if (cleaned.length > 60_000) {
    cleaned = extractScheduleSection(cleaned);
  }

  return cleaned;
}

/**
 * When HTML is too large, find the section with the highest density of
 * day-name references and return a window around it.
 */
function extractScheduleSection(html: string): string {
  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const lower = html.toLowerCase();
  const windowSize = 20_000; // ~5K tokens

  let bestStart = 0;
  let bestCount = 0;

  for (let i = 0; i < lower.length - windowSize; i += 1000) {
    const window = lower.slice(i, i + windowSize);
    const count = DAYS.reduce((sum, day) => sum + (window.split(day).length - 1), 0);
    if (count > bestCount) {
      bestCount = count;
      bestStart = i;
    }
  }

  return html.slice(bestStart, bestStart + windowSize);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/matthewschneider/Downloads/bjj-open-mat-finder && npx vitest run src/lib/extraction/__tests__/clean-html.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/extraction/clean-html.ts src/lib/extraction/__tests__/clean-html.test.ts
git commit -m "feat: add HTML cleaning module for AI extraction pipeline"
```

---

## Chunk 2: AI Extraction Module

### Task 4: Create Claude Haiku extraction module

**Files:**
- Create: `src/lib/extraction/ai-extract.ts`
- Create: `src/lib/extraction/__tests__/ai-extract.test.ts`

- [ ] **Step 1: Write the test file**

Create `src/lib/extraction/__tests__/ai-extract.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractWithAI, extractWithAIVision } from '../ai-extract';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

import Anthropic from '@anthropic-ai/sdk';

describe('extractWithAI', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate = vi.fn();
    (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      messages: { create: mockCreate },
    }));
  });

  it('parses tool_use response with open mats', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'tool_use',
        name: 'report_open_mats',
        input: {
          open_mats: [
            {
              class_name: 'Open Mat',
              day_of_week: 6,
              start_time: '12:00',
              end_time: '14:00',
              type: 'both',
              recurring: true,
              women_only: false,
              drop_in_fee: { free: true, unknown: false },
              visitor_access: 'open_to_all',
              intensity: 'casual',
            }
          ],
          schedule_page_found: true,
          confidence_note: null,
        },
      }],
      usage: { input_tokens: 500, output_tokens: 100 },
    });

    const result = await extractWithAI('<div>Saturday 12:00 PM - 2:00 PM Open Mat</div>');

    expect(result.openMats).toHaveLength(1);
    expect(result.openMats[0].class_name).toBe('Open Mat');
    expect(result.openMats[0].day_of_week).toBe(6);
    expect(result.openMats[0].start_time).toBe('12:00');
    expect(result.schedulePageFound).toBe(true);
    expect(result.tokensUsed.input).toBe(500);
  });

  it('returns empty array when no open mats found', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'tool_use',
        name: 'report_open_mats',
        input: {
          open_mats: [],
          schedule_page_found: true,
          confidence_note: 'Schedule found but no open mat sessions listed',
        },
      }],
      usage: { input_tokens: 500, output_tokens: 50 },
    });

    const result = await extractWithAI('<div>Monday: Fundamentals 6pm</div>');
    expect(result.openMats).toHaveLength(0);
    expect(result.schedulePageFound).toBe(true);
  });

  it('returns empty result on API error', async () => {
    mockCreate.mockRejectedValue(new Error('API timeout'));

    const result = await extractWithAI('<div>Schedule</div>');
    expect(result.openMats).toHaveLength(0);
    expect(result.schedulePageFound).toBe(false);
  });

  it('handles missing ANTHROPIC_API_KEY gracefully', async () => {
    const origKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    // The module checks for API key at call time
    const result = await extractWithAI('<div>Schedule</div>');
    expect(result.openMats).toHaveLength(0);

    process.env.ANTHROPIC_API_KEY = origKey;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/matthewschneider/Downloads/bjj-open-mat-finder && npx vitest run src/lib/extraction/__tests__/ai-extract.test.ts
```

Expected: FAIL — module `../ai-extract` not found.

- [ ] **Step 3: Implement ai-extract.ts**

Create `src/lib/extraction/ai-extract.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { AIExtractedOpenMat, AIExtractionResult } from './types';

const SYSTEM_PROMPT = `You are a BJJ (Brazilian Jiu-Jitsu) gym schedule data extractor.

Given the HTML content of a BJJ gym's website or schedule page, extract ALL open mat sessions.

## What is an open mat?
An open mat is a session where practitioners can come and roll (spar/grapple) freely — not a structured class with a specific curriculum. Open mats may or may not have a coach present.

## Common names for open mats
Open Mat, Open Roll, Free Roll, Free Rolling, Rolling, Mat Time, Casual Rolls, Open Training, Sparring, Live Training, Free Training, Open Rolling, Freestyle Rolling, Submission Wrestling, Open Gym, Roll Time, Grappling, Open Sparring, Live Rolling, Saturday/Sunday Roll, Weekend Roll, Lunch Roll, Morning Roll, Women's Open Mat, Ladies Roll, Women's Only, Girls Roll.

## What is NOT an open mat
Regular classes (Fundamentals, Basics, Advanced, Beginner), Kids classes, Competition Team practice (unless explicitly open to visitors), Private lessons, Yoga/Conditioning/Strength classes, Seminars, Belt promotions, Open Enrollment/Registration/Open House events.

## Instructions
- Extract EVERY open mat session you find
- Use 24-hour time format (HH:MM)
- Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday
- If uncertain whether something is an open mat, include it with a note
- If the page has no schedule content at all, set schedule_page_found to false`;

const TOOL_SCHEMA = {
  name: 'report_open_mats',
  description: 'Report extracted open mat sessions from the schedule page',
  input_schema: {
    type: 'object' as const,
    properties: {
      open_mats: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            class_name: { type: 'string', description: 'Name as listed on schedule' },
            day_of_week: { type: 'integer', minimum: 0, maximum: 6 },
            start_time: { type: 'string', description: '24h format HH:MM' },
            end_time: { type: ['string', 'null'], description: '24h format HH:MM or null' },
            type: { type: 'string', enum: ['gi', 'nogi', 'both', 'unknown'] },
            recurring: { type: 'boolean' },
            specific_date: { type: ['string', 'null'] },
            drop_in_fee: {
              type: 'object',
              properties: {
                free: { type: 'boolean' },
                amount: { type: ['number', 'null'] },
                first_visit_free: { type: ['boolean', 'null'] },
                unknown: { type: 'boolean' },
              },
              required: ['free', 'unknown'],
            },
            visitor_access: { type: 'string', enum: ['open_to_all', 'contact_first', 'members_only', 'unknown'] },
            advance_contact_required: { type: ['boolean', 'null'] },
            contact_instructions: { type: ['string', 'null'] },
            coaching_present: { type: ['boolean', 'null'] },
            intensity: { type: 'string', enum: ['casual', 'moderate', 'competition', 'varies', 'unknown'] },
            beginner_friendly: { type: ['boolean', 'null'] },
            women_only: { type: 'boolean' },
            competition_focused: { type: ['boolean', 'null'] },
            uniform_restrictions: { type: ['string', 'null'] },
            notes: { type: ['string', 'null'] },
          },
          required: ['class_name', 'day_of_week', 'start_time', 'end_time', 'type', 'recurring', 'women_only'],
        },
      },
      schedule_page_found: { type: 'boolean' },
      confidence_note: { type: ['string', 'null'] },
    },
    required: ['open_mats', 'schedule_page_found'],
  },
};

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set — AI extraction disabled');
    return null;
  }
  return new Anthropic({ apiKey });
}

/**
 * Extract open mats from cleaned HTML using Claude Haiku.
 */
export async function extractWithAI(cleanedHtml: string): Promise<AIExtractionResult> {
  const empty: AIExtractionResult = {
    openMats: [],
    schedulePageFound: false,
    confidenceNote: null,
    tokensUsed: { input: 0, output: 0 },
  };

  const client = getClient();
  if (!client) return empty;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: cleanedHtml },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool' as const, name: 'report_open_mats' },
    });

    const toolUse = response.content.find((c) => c.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') return empty;

    const input = toolUse.input as {
      open_mats: AIExtractedOpenMat[];
      schedule_page_found: boolean;
      confidence_note: string | null;
    };

    return {
      openMats: input.open_mats ?? [],
      schedulePageFound: input.schedule_page_found ?? false,
      confidenceNote: input.confidence_note ?? null,
      tokensUsed: {
        input: response.usage?.input_tokens ?? 0,
        output: response.usage?.output_tokens ?? 0,
      },
    };
  } catch (err) {
    console.error('AI extraction failed:', (err as Error).message);
    return empty;
  }
}

/**
 * Extract open mats from a screenshot using Claude Haiku Vision.
 */
export async function extractWithAIVision(screenshotBuffer: Buffer): Promise<AIExtractionResult> {
  const empty: AIExtractionResult = {
    openMats: [],
    schedulePageFound: false,
    confidenceNote: null,
    tokensUsed: { input: 0, output: 0 },
    isScreenshot: true,
  };

  const client = getClient();
  if (!client) return empty;

  try {
    const base64 = screenshotBuffer.toString('base64');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: base64 },
          },
          {
            type: 'text',
            text: 'This is a screenshot of a BJJ gym website. Extract any open mat sessions visible.',
          },
        ],
      }],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool' as const, name: 'report_open_mats' },
    });

    const toolUse = response.content.find((c) => c.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') return empty;

    const input = toolUse.input as {
      open_mats: AIExtractedOpenMat[];
      schedule_page_found: boolean;
      confidence_note: string | null;
    };

    return {
      openMats: input.open_mats ?? [],
      schedulePageFound: input.schedule_page_found ?? false,
      confidenceNote: input.confidence_note ?? null,
      tokensUsed: {
        input: response.usage?.input_tokens ?? 0,
        output: response.usage?.output_tokens ?? 0,
      },
      isScreenshot: true,
    };
  } catch (err) {
    console.error('AI vision extraction failed:', (err as Error).message);
    return empty;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/matthewschneider/Downloads/bjj-open-mat-finder && npx vitest run src/lib/extraction/__tests__/ai-extract.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/extraction/ai-extract.ts src/lib/extraction/__tests__/ai-extract.test.ts
git commit -m "feat: add Claude Haiku AI extraction module with tool_use schema"
```

---

## Chunk 3: Fetch Improvements, Schedule Discovery, Screenshot Fallback

### Task 5: Improve fetch with retry and relaxed content-type

**Files:**
- Modify: `src/lib/extraction/fetch.ts`

- [ ] **Step 1: Update fetch.ts with retry logic**

Replace the contents of `src/lib/extraction/fetch.ts`:

```typescript
import type { FetchResult } from './types';

const TIMEOUT_MS = 10_000;
const USER_AGENT = 'BJJOpenMatFinder/1.0 (https://bjj-open-mat-finder.vercel.app)';
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 3_000;

/**
 * Stage 1: Fetch a page with timeout, retry, redirect following, and content-type validation.
 * Returns null only after all retries exhausted.
 */
export async function fetchPage(url: string): Promise<FetchResult | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Fetch ${url}: HTTP ${response.status}`);
        if (attempt < MAX_RETRIES) {
          await delay(RETRY_DELAY_MS);
          continue;
        }
        return null;
      }

      const contentType = response.headers.get('content-type') ?? '';
      // Accept HTML, XHTML, or empty content-type (some gyms misconfigure headers)
      const isHtml = contentType.includes('text/html')
        || contentType.includes('text/xhtml')
        || contentType.includes('application/xhtml')
        || contentType === '';

      if (!isHtml) return null;

      const html = await response.text();

      return {
        html,
        statusCode: response.status,
        finalUrl: response.url,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Fetch ${url} attempt ${attempt + 1}: ${message}`);
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS);
        continue;
      }
      return null;
    }
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/extraction/fetch.ts
git commit -m "feat: add retry logic and relaxed content-type to page fetcher"
```

---

### Task 6: Expand schedule discovery

**Files:**
- Modify: `src/lib/extraction/discover-schedule.ts`

- [ ] **Step 1: Update discover-schedule.ts**

Replace the contents of `src/lib/extraction/discover-schedule.ts`:

```typescript
import * as cheerio from 'cheerio';
import { fetchPage } from './fetch';
import type { ScheduleDiscoveryResult } from './types';

const CONVENTION_PATHS = [
  '/schedule', '/class-schedule', '/classes', '/timetable',
  '/programs', '/weekly-schedule',
  // Expanded for v2:
  '/open-mat', '/open-mats', '/rolling', '/drop-in',
  '/sessions', '/calendar', '/training', '/events',
  '/adult-schedule', '/mat-times',
];

const SCHEDULE_LINK_KEYWORDS = [
  'schedule', 'class', 'timetable', 'program', 'calendar',
  // Expanded for v2:
  'open mat', 'rolling', 'session', 'training', 'drop-in',
];

const SCHEDULE_CONTENT_SIGNALS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

/**
 * Stage 2: Find the schedule page URL for a gym website.
 *
 * Strategy:
 * 1. Convention probing — try common URL paths
 * 2. Homepage link crawl — find links with schedule keywords
 * 3. Homepage-as-schedule — check if homepage itself has schedule content
 * 4. Homepage fallback — always return homepage so AI can try (never returns null)
 */
export async function discoverScheduleUrl(
  baseUrl: string,
  homepageHtml: string
): Promise<ScheduleDiscoveryResult> {
  const base = baseUrl.replace(/\/+$/, '');

  // Strategy 1: Convention probing
  for (const path of CONVENTION_PATHS) {
    const url = `${base}${path}`;
    const result = await fetchPage(url);
    if (result && hasScheduleContent(result.html)) {
      return { scheduleUrl: result.finalUrl, scheduleHtml: result.html };
    }
  }

  // Strategy 2: Homepage link crawl
  const $ = cheerio.load(homepageHtml);
  const links: { url: string; score: number }[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().toLowerCase();
    const hrefLower = href.toLowerCase();

    let score = 0;
    for (const kw of SCHEDULE_LINK_KEYWORDS) {
      if (hrefLower.includes(kw)) score += 2;
      if (text.includes(kw)) score += 1;
    }

    if (score > 0) {
      let fullUrl: string;
      try {
        fullUrl = new URL(href, base).href;
      } catch {
        return;
      }
      links.push({ url: fullUrl, score });
    }
  });

  links.sort((a, b) => b.score - a.score);

  for (const link of links.slice(0, 5)) {
    const result = await fetchPage(link.url);
    if (result && hasScheduleContent(result.html)) {
      return { scheduleUrl: result.finalUrl, scheduleHtml: result.html };
    }
  }

  // Strategy 3: Homepage itself has schedule content
  if (hasScheduleContent(homepageHtml)) {
    return { scheduleUrl: base, scheduleHtml: homepageHtml };
  }

  // Strategy 4: Always return homepage so AI can try — never returns null
  return { scheduleUrl: base, scheduleHtml: homepageHtml, isHomepageFallback: true };
}

function hasScheduleContent(html: string): boolean {
  const lower = html.toLowerCase();
  const daysFound = SCHEDULE_CONTENT_SIGNALS.filter((day) => lower.includes(day));
  return daysFound.length >= 3;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/extraction/discover-schedule.ts
git commit -m "feat: expand schedule discovery with 16 URL paths and homepage fallback"
```

---

### Task 7: Create Playwright screenshot module

**Files:**
- Create: `src/lib/extraction/screenshot.ts`

- [ ] **Step 1: Create screenshot.ts**

```typescript
/**
 * Playwright-based screenshot capture for JS-rendered and image-based schedule pages.
 * Used as fallback when HTML-based AI extraction finds no schedule content.
 *
 * NOTE: Playwright requires chromium binary. For bulk runs, use the shared browser
 * functions to avoid launching/closing per gym.
 */

let sharedBrowser: import('playwright').Browser | null = null;

/**
 * Launch a shared browser instance for bulk runs.
 * Call closeBrowser() when done.
 */
export async function launchBrowser(): Promise<void> {
  if (sharedBrowser) return;
  const { chromium } = await import('playwright');
  sharedBrowser = await chromium.launch({ headless: true });
}

/**
 * Close the shared browser instance.
 */
export async function closeBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

/**
 * Capture a full-page screenshot of a URL.
 * Uses shared browser if available, otherwise launches a temporary one.
 */
export async function captureScheduleScreenshot(url: string): Promise<Buffer | null> {
  const { chromium } = await import('playwright');
  const isTemporary = !sharedBrowser;
  const browser = sharedBrowser ?? await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 2000 },
      userAgent: 'BJJOpenMatFinder/1.0',
    });

    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout: 15_000 });

    // Scroll to trigger lazy-loaded content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    const screenshot = await page.screenshot({ fullPage: true, type: 'png' });

    await context.close();

    return Buffer.from(screenshot);
  } catch (err) {
    console.warn(`Screenshot failed for ${url}: ${(err as Error).message}`);
    return null;
  } finally {
    if (isTemporary) {
      await browser.close();
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/extraction/screenshot.ts
git commit -m "feat: add Playwright screenshot capture for schedule fallback"
```

---

## Chunk 4: Validation Update, Pipeline Rewrite, Script Updates

### Task 8: Update validation to accept AI-enriched fields

**Files:**
- Modify: `src/lib/extraction/validate.ts`

- [ ] **Step 1: Rewrite validate.ts**

Replace contents of `src/lib/extraction/validate.ts`:

```typescript
import type { AIExtractedOpenMat, ValidatedOpenMat } from './types';
import type {
  MartialArtType, VisitorAccess, IntensityLevel,
  WomenPresence, CoachingPresence, BeginnerFriendly,
} from '@/lib/types';

/**
 * Stage 5: Validate and normalize AI-extracted open mats for database insertion.
 */
export function validateAIResults(
  extracted: AIExtractedOpenMat[],
  gymId: string,
  sourceUrl: string,
  sourceType: 'website_scrape' | 'image_ocr',
  confidenceNote: string | null,
  needsReview: boolean,
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
    if (startTime >= endTime) continue;

    // Map AI type — 'unknown' becomes 'both' with needs_review flag
    let type: MartialArtType = 'both';
    let reviewNeeded = needsReview;
    if (item.type === 'gi' || item.type === 'nogi' || item.type === 'both') {
      type = item.type;
    } else {
      reviewNeeded = true;
    }

    // Map visitor access
    const visitorAccess: VisitorAccess =
      (item.visitor_access as VisitorAccess) ?? 'unknown';

    // Map intensity
    const intensity: IntensityLevel =
      (item.intensity as IntensityLevel) ?? 'unknown';

    // Map women's presence
    const womenPresence: WomenPresence = item.women_only
      ? 'women_specific'
      : 'unknown';

    // Map coaching
    const coachingPresent: CoachingPresence = item.coaching_present === true
      ? 'yes'
      : item.coaching_present === false
        ? 'no'
        : 'unknown';

    // Map beginner-friendly
    const beginnerFriendly: BeginnerFriendly = item.beginner_friendly === true
      ? 'yes'
      : item.beginner_friendly === false
        ? 'not_really'
        : 'unknown';

    // Map drop-in fee
    const dropInFee = item.drop_in_fee ?? { free: false, unknown: true };
    const price = dropInFee.free ? 0 : (dropInFee.amount ?? 0);

    results.push({
      gym_id: gymId,
      day_of_week: item.day_of_week,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      type,
      recurring: item.recurring ?? true,
      specific_date: item.specific_date ?? null,
      age_policy: 'unknown',
      source_type: sourceType,
      source_url: sourceUrl,
      last_source_check: now,
      needs_review: reviewNeeded,
      confidence_score: sourceType === 'website_scrape' ? 'low' : 'unverified',
      freshness_status: sourceType === 'website_scrape' ? 'likely_current' : 'unverified',
      confirmation_method: 'website_scrape',
      // AI-enriched fields
      price,
      drop_in_fee: {
        free: dropInFee.free,
        amount: dropInFee.amount ?? undefined,
        first_visit_free: dropInFee.first_visit_free ?? undefined,
        unknown: dropInFee.unknown,
      },
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
      extraction_notes: confidenceNote ?? undefined,
    });
  }

  return results;
}

// --- Keep legacy function for backward compat with old parsers ---
export { validateAndNormalize } from './validate-legacy';

// --- Helpers ---

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
```

- [ ] **Step 2: Rename old validate.ts to validate-legacy.ts**

```bash
cd /Users/matthewschneider/Downloads/bjj-open-mat-finder
cp src/lib/extraction/validate.ts src/lib/extraction/validate-legacy.ts
```

Then write the new validate.ts with the content above.

- [ ] **Step 3: Commit**

```bash
git add src/lib/extraction/validate.ts src/lib/extraction/validate-legacy.ts
git commit -m "feat: update validation for AI-enriched extraction fields"
```

---

### Task 9: Rewrite pipeline orchestrator

**Files:**
- Modify: `src/lib/extraction/pipeline.ts`

- [ ] **Step 1: Rewrite pipeline.ts**

Replace the contents of `src/lib/extraction/pipeline.ts`:

```typescript
import { fetchPage } from './fetch';
import { discoverScheduleUrl } from './discover-schedule';
import { cleanHtmlForAI } from './clean-html';
import { extractWithAI, extractWithAIVision } from './ai-extract';
import { captureScheduleScreenshot } from './screenshot';
import { validateAIResults } from './validate';
import type { PipelineResult } from './types';

interface PipelineOptions {
  gymId: string;
  gymName: string;
  websiteUrl: string;
  needsReview: boolean;
  skipScreenshot?: boolean;
}

/**
 * AI-first extraction pipeline v2.
 *
 * Flow: Fetch → Discover Schedule → Clean HTML → Claude Haiku → Screenshot Fallback → Validate
 */
export async function runExtractionPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const { gymId, gymName, websiteUrl, needsReview, skipScreenshot } = options;

  const result: PipelineResult = {
    gymId,
    gymName,
    success: false,
    stage: 'fetch',
    extractedCount: 0,
    savedCount: 0,
    openMats: [],
    tokensUsed: { input: 0, output: 0 },
  };

  // Stage 1: Fetch homepage
  const homepage = await fetchPage(websiteUrl);
  if (!homepage) {
    result.error = `Failed to fetch ${websiteUrl}`;
    return result;
  }

  // Stage 2: Discover schedule URL (never returns null in v2)
  result.stage = 'discover_schedule';
  const schedule = await discoverScheduleUrl(websiteUrl, homepage.html);
  result.scheduleUrl = schedule.scheduleUrl;

  // Stage 3: Clean HTML for AI
  result.stage = 'clean_html';
  const cleanedHtml = cleanHtmlForAI(schedule.scheduleHtml);

  // Stage 4: Claude Haiku extraction
  result.stage = 'ai_extract';
  let aiResult = await extractWithAI(cleanedHtml);
  result.tokensUsed = { ...aiResult.tokensUsed };
  result.platform = 'ai_haiku';

  // Stage 4b: Screenshot fallback if AI found no schedule content
  if (aiResult.openMats.length === 0 && !aiResult.schedulePageFound && !skipScreenshot) {
    result.stage = 'screenshot_fallback';
    const screenshot = await captureScheduleScreenshot(schedule.scheduleUrl);
    if (screenshot) {
      const visionResult = await extractWithAIVision(screenshot);
      if (visionResult.openMats.length > 0 || visionResult.schedulePageFound) {
        aiResult = visionResult;
        result.platform = 'ai_vision';
        result.tokensUsed.input += visionResult.tokensUsed.input;
        result.tokensUsed.output += visionResult.tokensUsed.output;
      }
    }
  }

  result.extractedCount = aiResult.openMats.length;

  if (aiResult.openMats.length === 0) {
    result.success = true;
    result.error = aiResult.schedulePageFound
      ? 'Schedule found but no open mats detected'
      : 'No schedule content found on website';
    return result;
  }

  // Stage 5: Validate & normalize
  result.stage = 'validate';
  const sourceType = aiResult.isScreenshot ? 'image_ocr' as const : 'website_scrape' as const;
  const validated = validateAIResults(
    aiResult.openMats,
    gymId,
    schedule.scheduleUrl,
    sourceType,
    aiResult.confidenceNote,
    needsReview,
  );

  result.openMats = validated;
  result.success = true;
  result.stage = 'save';

  return result;
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd /Users/matthewschneider/Downloads/bjj-open-mat-finder && npx tsc --noEmit --pretty 2>&1 | head -30
```

Fix any remaining type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/extraction/pipeline.ts
git commit -m "feat: rewrite pipeline orchestrator for AI-first extraction v2"
```

---

### Task 10: Update bulk extraction script with cost guards

**Files:**
- Modify: `scripts/extract-all.ts`

- [ ] **Step 1: Update extract-all.ts**

Replace the contents of `scripts/extract-all.ts`:

```typescript
/**
 * Run AI-first extraction pipeline for ALL gyms with websites.
 *
 * Usage:
 *   npx tsx scripts/extract-all.ts                    # Dry run (no DB writes, no AI calls)
 *   npx tsx scripts/extract-all.ts --save             # Full run with DB writes
 *   npx tsx scripts/extract-all.ts --save --skip-screenshot  # Skip Playwright fallback
 *   npx tsx scripts/extract-all.ts --save --max-cost 10      # Stop at $10 API spend
 *   npx tsx scripts/extract-all.ts --save --skip-fresh 30    # Skip gyms scraped <30 days ago
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createServiceClient } from '../src/lib/supabase/service';
import { runExtractionPipeline } from '../src/lib/extraction/pipeline';
import { launchBrowser, closeBrowser } from '../src/lib/extraction/screenshot';

// Haiku pricing: $1/M input, $5/M output
const COST_PER_INPUT_TOKEN = 1 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 5 / 1_000_000;

function parseFlag(flag: string, defaultVal: number): number {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return defaultVal;
  return parseFloat(process.argv[idx + 1]);
}

async function main() {
  const shouldSave = process.argv.includes('--save');
  const skipScreenshot = process.argv.includes('--skip-screenshot');
  const maxCost = parseFlag('--max-cost', 25);
  const skipFreshDays = parseFlag('--skip-fresh', 30);
  const isDryRun = !shouldSave;

  const supabase = createServiceClient();

  const { data: gyms, error } = await supabase
    .from('gyms')
    .select('id, name, website, last_scraped_at')
    .not('website', 'is', null)
    .order('name');

  if (error || !gyms) {
    console.error('Failed to fetch gyms:', error?.message);
    process.exit(1);
  }

  // Filter out recently scraped gyms
  const cutoff = new Date(Date.now() - skipFreshDays * 24 * 60 * 60 * 1000).toISOString();
  const eligibleGyms = gyms.filter((g) => {
    if (!g.last_scraped_at) return true;
    return g.last_scraped_at < cutoff;
  });

  console.log(`Found ${gyms.length} gyms with websites (${eligibleGyms.length} eligible after freshness filter)`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (stages 1-3 only, no AI calls)' : 'FULL RUN'}`);
  console.log(`Max cost: $${maxCost} | Skip screenshot: ${skipScreenshot} | Skip fresh: ${skipFreshDays} days\n`);

  if (!skipScreenshot && shouldSave) {
    console.log('Launching shared browser for screenshot fallback...');
    await launchBrowser();
  }

  const stats = {
    total: eligibleGyms.length,
    success: 0,
    noSchedule: 0,
    noOpenMats: 0,
    failed: 0,
    totalOpenMats: 0,
    totalCost: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
  };

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  try {
    for (let i = 0; i < eligibleGyms.length; i++) {
      const gym = eligibleGyms[i];
      if (!gym.website) continue;

      // Cost guard
      if (stats.totalCost >= maxCost) {
        console.log(`\n⚠ Cost limit reached ($${stats.totalCost.toFixed(4)} >= $${maxCost}). Stopping.`);
        break;
      }

      process.stdout.write(`[${i + 1}/${eligibleGyms.length}] ${gym.name}... `);

      if (isDryRun) {
        // Dry run: just fetch and discover, no AI call
        console.log('(dry run — skipped)');
        continue;
      }

      const result = await runExtractionPipeline({
        gymId: gym.id,
        gymName: gym.name,
        websiteUrl: gym.website,
        needsReview: true,
        skipScreenshot,
      });

      // Track costs
      if (result.tokensUsed) {
        stats.totalInputTokens += result.tokensUsed.input;
        stats.totalOutputTokens += result.tokensUsed.output;
        stats.totalCost +=
          result.tokensUsed.input * COST_PER_INPUT_TOKEN +
          result.tokensUsed.output * COST_PER_OUTPUT_TOKEN;
      }

      // Update gym metadata
      await supabase.from('gyms').update({
        platform_type: result.platform ?? null,
        schedule_page_url: result.scheduleUrl ?? null,
        schedule_format: result.platform?.includes('ai') ? 'ai_extracted' : null,
        last_scraped_at: new Date().toISOString(),
        scrape_status: result.success
          ? (result.extractedCount > 0 ? 'success' : 'no_open_mats')
          : (result.error?.includes('fetch') ? 'failed' : 'no_schedule'),
        scrape_error: result.error ?? null,
      }).eq('id', gym.id);

      if (result.openMats.length > 0) {
        stats.success++;
        stats.totalOpenMats += result.openMats.length;
        console.log(`✓ ${result.openMats.length} open mats (${result.platform})`);

        for (const om of result.openMats) {
          console.log(`    ${days[om.day_of_week]} ${om.start_time}-${om.end_time} (${om.type})`);
        }

        // Save: delete old scrape data, insert new
        await supabase
          .from('open_mats')
          .delete()
          .eq('gym_id', gym.id)
          .in('source_type', ['website_scrape', 'image_ocr']);

        const { error: insertErr } = await supabase
          .from('open_mats')
          .insert(result.openMats);

        if (insertErr) {
          console.log(`    ⚠ Save failed: ${insertErr.message}`);
        }
      } else if (!result.success) {
        stats.failed++;
        console.log(`✗ ${result.error}`);
      } else {
        stats.noOpenMats++;
        console.log(`— ${result.error ?? 'no open mats found'}`);
      }

      // Polite delay
      await new Promise((r) => setTimeout(r, 500));
    }
  } finally {
    await closeBrowser();
  }

  console.log('\n========== SUMMARY ==========');
  console.log(`Total gyms:       ${stats.total}`);
  console.log(`Open mats found:  ${stats.success} gyms, ${stats.totalOpenMats} total sessions`);
  console.log(`No open mats:     ${stats.noOpenMats}`);
  console.log(`Failed:           ${stats.failed}`);
  console.log(`--- API Usage ---`);
  console.log(`Input tokens:     ${stats.totalInputTokens.toLocaleString()}`);
  console.log(`Output tokens:    ${stats.totalOutputTokens.toLocaleString()}`);
  console.log(`Total cost:       $${stats.totalCost.toFixed(4)}`);
}

main().catch(console.error);
```

- [ ] **Step 2: Commit**

```bash
git add scripts/extract-all.ts
git commit -m "feat: update bulk extraction script with cost guards and token tracking"
```

---

### Task 11: Run full test suite, fix any breaks

- [ ] **Step 1: Run all tests**

```bash
cd /Users/matthewschneider/Downloads/bjj-open-mat-finder && npx vitest run
```

- [ ] **Step 2: Fix any type errors or broken imports**

The old tests for kicksite, zenplanner, mindbody, generic-html, and shared parsers may have import issues since types.ts changed. These parsers are deprecated but their tests should still pass. Fix any import issues.

- [ ] **Step 3: Verify build passes**

```bash
cd /Users/matthewschneider/Downloads/bjj-open-mat-finder && npm run build
```

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve type and import issues after pipeline v2 migration"
```

---

### Task 12: Integration test — run against a real gym

- [ ] **Step 1: Ensure ANTHROPIC_API_KEY is set in .env.local**

Ask user for their Anthropic API key if not already set.

- [ ] **Step 2: Test single gym extraction**

```bash
cd /Users/matthewschneider/Downloads/bjj-open-mat-finder && npx tsx scripts/extract-gym.ts <gym-id-from-db>
```

Verify that:
- AI extraction returns structured open mat data
- Token usage is reported
- Data includes enriched fields (visitor_access, intensity, etc.)

- [ ] **Step 3: Test bulk extraction with small batch**

```bash
cd /Users/matthewschneider/Downloads/bjj-open-mat-finder && npx tsx scripts/extract-all.ts --save --max-cost 1 --skip-screenshot
```

Verify that:
- Cost tracking works
- Open mats are saved to database
- Pipeline reports success/failure correctly

- [ ] **Step 4: Commit any fixes from integration testing**

```bash
git add -A
git commit -m "fix: integration test fixes for AI extraction pipeline"
```
