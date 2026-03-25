# Extraction Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Tier A schedule extraction pipeline that scrapes gym websites, finds open mat schedules, and populates the `open_mats` table — turning 214 empty gym shells into actionable listings.

**Architecture:** 6-stage pipeline (fetch → discover schedule URL → detect platform → extract → validate → save) with a parser registry pattern. Two parsers: Kicksite (mobile view, high confidence) and generic HTML (table/grid fallback, lower confidence). Admin dashboard gets an "Extraction" tab with per-gym scrape buttons and review gate.

**Tech Stack:** Next.js 16, Supabase (service role client for writes), cheerio (HTML parsing), vitest (testing)

---

## Chunk 1: Foundation — Types, Dependencies, Service Role Client

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install cheerio and vitest**

```bash
cd /Users/matthewschneider/Downloads/bjj-open-mat-finder
npm install cheerio
npm install -D vitest @testing-library/react
```

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest.config.ts**

Create `vitest.config.ts` at the project root to resolve the `@/` path alias:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "feat: add cheerio and vitest dependencies for extraction pipeline"
```

### Task 2: Add Supabase service role key

**Files:**
- Modify: `.env.local`
- Modify: `.env.example`

- [ ] **Step 1: Get service role key from Supabase dashboard**

The user must provide this. The key is found at: Supabase Dashboard → Project Settings → API → `service_role` (secret).

Add to `.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=<paste-key-here>
```

Add placeholder to `.env.example`:
```
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 2: Commit .env.example only**

```bash
git add .env.example
git commit -m "feat: add SUPABASE_SERVICE_ROLE_KEY to env example"
```

### Task 3: Create service role Supabase client

**Files:**
- Create: `src/lib/supabase/service.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/supabase/__tests__/service.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock the supabase-js module
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}));

describe('createServiceClient', () => {
  it('creates a client with service role key', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    const { createServiceClient } = await import('../service');
    const client = createServiceClient();
    expect(client).toBeDefined();
    expect(client.from).toBeDefined();
  });

  it('throws if service role key is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Re-import to get fresh module
    vi.resetModules();
    const { createServiceClient } = await import('../service');
    expect(() => createServiceClient()).toThrow('SUPABASE_SERVICE_ROLE_KEY');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/supabase/__tests__/service.test.ts
```

Expected: FAIL — module `../service` not found.

- [ ] **Step 3: Write implementation**

Create `src/lib/supabase/service.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client with the service role key.
 * Bypasses RLS — use only for server-side admin operations
 * (extraction pipeline, bulk imports, etc.)
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/supabase/__tests__/service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/service.ts src/lib/supabase/__tests__/service.test.ts
git commit -m "feat: add Supabase service role client for extraction pipeline"
```

### Task 4: Create extraction types

**Files:**
- Create: `src/lib/extraction/types.ts`

- [ ] **Step 1: Write the types file**

Create `src/lib/extraction/types.ts`:
```typescript
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
  confidence: number; // 0.0 - 1.0
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
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  startTime: string; // HH:MM (24h)
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
  start_time: string; // HH:MM:SS
  end_time: string;   // HH:MM:SS (defaulted if not found)
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
  stage: PipelineStage;         // last stage reached
  error?: string;
  scheduleUrl?: string;
  platform?: string;
  extractedCount: number;       // raw extraction count
  savedCount: number;           // after validation + save
  openMats: ValidatedOpenMat[]; // for admin review
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/extraction/types.ts
git commit -m "feat: add extraction pipeline types"
```

### Task 5: Update Gym and OpenMat TypeScript interfaces

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add extraction fields to Gym interface**

After the `discovery_source` field (around line 109), add:
```typescript
  // Extraction pipeline metadata
  platform_type: string | null;
  schedule_page_url: string | null;
  schedule_format: string | null;
  last_scraped_at: string | null;
  scrape_status: string | null;
  scrape_error: string | null;
```

- [ ] **Step 2: Add source tracking fields to OpenMat interface**

After the `evidence_sources` field (around line 159), add:
```typescript
  // Extraction source tracking
  source_type: string | null;
  source_url: string | null;
  last_source_check: string | null;
  needs_review: boolean;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add extraction fields to Gym and OpenMat types"
```

### Task 6: Create database migration

**Files:**
- Create: `supabase/migrations/003_extraction_pipeline.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/003_extraction_pipeline.sql`:
```sql
-- Migration 003: Extraction Pipeline
-- Adds gym website platform detection and open mat source tracking

-- Gym extraction metadata
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS platform_type text;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS schedule_page_url text;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS schedule_format text;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS last_scraped_at timestamptz;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS scrape_status text;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS scrape_error text;

-- Open mat source tracking
ALTER TABLE open_mats ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'community_submission';
ALTER TABLE open_mats ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE open_mats ADD COLUMN IF NOT EXISTS last_source_check timestamptz;
ALTER TABLE open_mats ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;

-- Index for extraction dashboard queries
CREATE INDEX IF NOT EXISTS idx_gyms_scrape_status ON gyms(scrape_status);
CREATE INDEX IF NOT EXISTS idx_gyms_platform_type ON gyms(platform_type);
CREATE INDEX IF NOT EXISTS idx_open_mats_source_type ON open_mats(source_type);
CREATE INDEX IF NOT EXISTS idx_open_mats_needs_review ON open_mats(needs_review) WHERE needs_review = true;
```

- [ ] **Step 2: Run migration against live Supabase**

This must be run via the Supabase SQL Editor (same method used for migrations 001 and 002 — via Chrome extension MCP tools).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_extraction_pipeline.sql
git commit -m "feat: add migration 003 for extraction pipeline schema"
```

---

## Chunk 2: Stages 1-2 — Fetch and Schedule URL Discovery

### Task 7: Build Stage 1 — HTTP Fetch

**Files:**
- Create: `src/lib/extraction/fetch.ts`
- Create: `src/lib/extraction/__tests__/fetch.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/extraction/__tests__/fetch.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPage } from '../fetch';

describe('fetchPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches a page and returns html + status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://example.com/',
      headers: { get: () => 'text/html' },
      text: () => Promise.resolve('<html><body>Hello</body></html>'),
    });

    const result = await fetchPage('https://example.com/');
    expect(result).not.toBeNull();
    expect(result!.html).toContain('Hello');
    expect(result!.statusCode).toBe(200);
    expect(result!.finalUrl).toBe('https://example.com/');
  });

  it('returns null on timeout/network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('timeout'));
    const result = await fetchPage('https://unreachable.example.com/');
    expect(result).toBeNull();
  });

  it('returns null for non-HTML responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://example.com/file.pdf',
      headers: { get: () => 'application/pdf' },
      text: () => Promise.resolve('%PDF-1.4'),
    });

    const result = await fetchPage('https://example.com/file.pdf');
    expect(result).toBeNull();
  });

  it('returns null for 404 responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      url: 'https://example.com/missing',
      headers: { get: () => 'text/html' },
      text: () => Promise.resolve('Not Found'),
    });

    const result = await fetchPage('https://example.com/missing');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/extraction/__tests__/fetch.test.ts
```

Expected: FAIL — module `../fetch` not found.

- [ ] **Step 3: Write implementation**

Create `src/lib/extraction/fetch.ts`:
```typescript
import type { FetchResult } from './types';

const TIMEOUT_MS = 10_000;
const USER_AGENT = 'BJJOpenMatFinder/1.0 (https://bjj-open-mat-finder.vercel.app)';

/**
 * Stage 1: Fetch a page with timeout, redirect following, and content-type validation.
 * Returns null on any error (timeout, DNS, 4xx/5xx, non-HTML).
 */
export async function fetchPage(url: string): Promise<FetchResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/xhtml')) {
      return null;
    }

    const html = await response.text();

    return {
      html,
      statusCode: response.status,
      finalUrl: response.url,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/extraction/__tests__/fetch.test.ts
```

Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/extraction/fetch.ts src/lib/extraction/__tests__/fetch.test.ts
git commit -m "feat: add Stage 1 fetch with timeout and content-type validation"
```

### Task 8: Build Stage 2 — Schedule URL Discovery

**Files:**
- Create: `src/lib/extraction/discover-schedule.ts`
- Create: `src/lib/extraction/__tests__/discover-schedule.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/extraction/__tests__/discover-schedule.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverScheduleUrl } from '../discover-schedule';

// Mock fetchPage
vi.mock('../fetch', () => ({
  fetchPage: vi.fn(),
}));

import { fetchPage } from '../fetch';
const mockFetchPage = vi.mocked(fetchPage);

describe('discoverScheduleUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('finds schedule via convention probing (/schedule)', async () => {
    mockFetchPage.mockImplementation(async (url: string) => {
      if (url.endsWith('/schedule') || url.endsWith('/schedule/')) {
        return {
          html: '<html><body><div class="schedule-container">Schedule here</div></body></html>',
          statusCode: 200,
          finalUrl: url,
        };
      }
      return null;
    });

    const result = await discoverScheduleUrl('https://example-gym.com', '<html></html>');
    expect(result).not.toBeNull();
    expect(result!.scheduleUrl).toContain('/schedule');
    expect(result!.scheduleHtml).toContain('schedule-container');
  });

  it('falls back to homepage link crawl', async () => {
    // Convention probing fails for all paths
    mockFetchPage.mockImplementation(async (url: string) => {
      if (url.includes('/our-schedule')) {
        return {
          html: '<html><body>Our Schedule Page</body></html>',
          statusCode: 200,
          finalUrl: url,
        };
      }
      return null;
    });

    const homepageHtml = `<html><body>
      <a href="/about">About</a>
      <a href="/our-schedule">View Our Schedule</a>
      <a href="/contact">Contact</a>
    </body></html>`;

    const result = await discoverScheduleUrl('https://example-gym.com', homepageHtml);
    expect(result).not.toBeNull();
    expect(result!.scheduleUrl).toContain('/our-schedule');
  });

  it('detects schedule content on homepage itself', async () => {
    // Convention probing fails
    mockFetchPage.mockResolvedValue(null);

    const homepageHtml = `<html><body>
      <h2>Our Schedule</h2>
      <table><tr><th>Monday</th><th>Tuesday</th><th>Wednesday</th></tr></table>
    </body></html>`;

    const result = await discoverScheduleUrl('https://example-gym.com', homepageHtml);
    expect(result).not.toBeNull();
    expect(result!.scheduleUrl).toBe('https://example-gym.com');
    expect(result!.scheduleHtml).toContain('Monday');
  });

  it('returns null when no schedule found anywhere', async () => {
    mockFetchPage.mockResolvedValue(null);

    const homepageHtml = '<html><body><p>Welcome to our gym!</p></body></html>';
    const result = await discoverScheduleUrl('https://example-gym.com', homepageHtml);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/extraction/__tests__/discover-schedule.test.ts
```

Expected: FAIL — module `../discover-schedule` not found.

- [ ] **Step 3: Write implementation**

Create `src/lib/extraction/discover-schedule.ts`:
```typescript
import * as cheerio from 'cheerio';
import { fetchPage } from './fetch';
import type { ScheduleDiscoveryResult } from './types';

const CONVENTION_PATHS = [
  '/schedule',
  '/class-schedule',
  '/classes',
  '/timetable',
  '/programs',
  '/weekly-schedule',
];

const SCHEDULE_LINK_KEYWORDS = ['schedule', 'class', 'timetable', 'program', 'calendar'];
const SCHEDULE_CONTENT_SIGNALS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * Stage 2: Find the schedule page URL for a gym website.
 *
 * Strategy:
 * 1. Convention probing — try common URL paths
 * 2. Homepage link crawl — find links with schedule keywords
 * 3. Homepage-as-schedule — check if homepage itself has schedule content
 */
export async function discoverScheduleUrl(
  baseUrl: string,
  homepageHtml: string
): Promise<ScheduleDiscoveryResult | null> {
  // Normalize base URL (remove trailing slash)
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
      // Resolve relative URLs
      let fullUrl: string;
      try {
        fullUrl = new URL(href, base).href;
      } catch {
        return; // skip invalid URLs
      }
      links.push({ url: fullUrl, score });
    }
  });

  // Sort by score descending, try the best match
  links.sort((a, b) => b.score - a.score);

  for (const link of links.slice(0, 3)) {
    const result = await fetchPage(link.url);
    if (result && hasScheduleContent(result.html)) {
      return { scheduleUrl: result.finalUrl, scheduleHtml: result.html };
    }
  }

  // Strategy 3: Homepage itself has schedule content
  if (hasScheduleContent(homepageHtml)) {
    return { scheduleUrl: base, scheduleHtml: homepageHtml };
  }

  return null;
}

/**
 * Check if HTML likely contains schedule content by looking for
 * day-of-week names (at least 3 different days present).
 */
function hasScheduleContent(html: string): boolean {
  const lower = html.toLowerCase();
  const daysFound = SCHEDULE_CONTENT_SIGNALS.filter((day) => lower.includes(day));
  return daysFound.length >= 3;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/extraction/__tests__/discover-schedule.test.ts
```

Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/extraction/discover-schedule.ts src/lib/extraction/__tests__/discover-schedule.test.ts
git commit -m "feat: add Stage 2 schedule URL discovery with convention probing and link crawl"
```

---

## Chunk 3: Stages 3-4 — Platform Detection and Parsers

### Task 9: Build Kicksite Parser

**Files:**
- Create: `src/lib/extraction/parsers/kicksite.ts`
- Create: `src/lib/extraction/__tests__/kicksite.test.ts`

- [ ] **Step 1: Write failing test using real Kicksite HTML fixture**

First, save the real Kicksite HTML as a test fixture:
```bash
curl -s -L -A "BJJOpenMatFinder/1.0" "https://carlsongraciegreenvalley.com/schedule/" > src/lib/extraction/__tests__/fixtures/kicksite-carlson-gracie.html
```

Create `src/lib/extraction/__tests__/kicksite.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { kicksiteParser } from '../parsers/kicksite';

const fixtureHtml = readFileSync(
  join(__dirname, 'fixtures/kicksite-carlson-gracie.html'),
  'utf-8'
);

describe('Kicksite Parser', () => {
  describe('detect', () => {
    it('detects Kicksite schedule page', () => {
      const result = kicksiteParser.detect(fixtureHtml);
      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('does not detect non-Kicksite HTML', () => {
      const result = kicksiteParser.detect('<html><body>Just a regular page</body></html>');
      expect(result.detected).toBe(false);
    });
  });

  describe('extract', () => {
    it('extracts the Saturday open mat', () => {
      const results = kicksiteParser.extract(fixtureHtml);
      expect(results.length).toBeGreaterThanOrEqual(1);

      const openMat = results.find(
        (r) => r.className.toLowerCase().includes('open mat')
      );
      expect(openMat).toBeDefined();
      expect(openMat!.dayOfWeek).toBe(6); // Saturday
      expect(openMat!.startTime).toBe('12:00');
      expect(openMat!.endTime).toBe('14:00');
    });

    it('returns empty array for non-Kicksite HTML', () => {
      const results = kicksiteParser.extract('<html><body>No schedule</body></html>');
      expect(results).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/extraction/__tests__/kicksite.test.ts
```

Expected: FAIL — module `../parsers/kicksite` not found.

- [ ] **Step 3: Create shared parser utilities (must exist before kicksite.ts)**

Create `src/lib/extraction/parsers/shared.ts`:
```typescript
const OPEN_MAT_INCLUDE = [
  'open mat', 'open roll', 'free roll', 'open training', 'open gym',
];
const OPEN_MAT_EXCLUDE = [
  'open enrollment', 'open house', 'open door',
];

/**
 * Check if a class name matches open mat keywords.
 * Case-insensitive. Excludes false positives like "open enrollment".
 */
export function isOpenMatKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  if (OPEN_MAT_EXCLUDE.some((ex) => lower.includes(ex))) return false;
  return OPEN_MAT_INCLUDE.some((kw) => lower.includes(kw));
}

/**
 * Parse a time range string like "12:00 - 2:00 pm" into 24h format.
 * Returns { startTime, endTime } in "HH:MM" format.
 */
export function parseTimeRange(text: string): { startTime: string | null; endTime: string | null } {
  // Match patterns like "12:00 - 2:00 pm", "5:45 - 7:00 am", "6:00 pm - 8:00 pm"
  const match = text.match(
    /(\d{1,2}):(\d{2})\s*(am|pm)?\s*[-–]\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i
  );

  if (!match) return { startTime: null, endTime: null };

  const [, startH, startM, startAmpm, endH, endM, endAmpm] = match;

  // The end period is usually explicit; if start period is missing, infer from end
  const endPeriod = (endAmpm ?? startAmpm ?? '').toLowerCase();
  const startPeriod = (startAmpm ?? endAmpm ?? '').toLowerCase();

  const startTime = to24h(parseInt(startH), parseInt(startM), startPeriod);
  const endTime = to24h(parseInt(endH), parseInt(endM), endPeriod);

  return { startTime, endTime };
}

function to24h(hours: number, minutes: number, period: string): string {
  let h = hours;
  if (period === 'pm' && h < 12) h += 12;
  if (period === 'am' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
```

- [ ] **Step 4: Write Kicksite parser implementation**

Create `src/lib/extraction/parsers/kicksite.ts`:
```typescript
import * as cheerio from 'cheerio';
import type { ScheduleParser, DetectionResult, ExtractedOpenMat } from '../types';
import { isOpenMatKeyword, parseTimeRange } from './shared';

const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

/**
 * Kicksite parser — uses the mobile schedule view which has a clean
 * day → time → class structure that's much easier to parse than the
 * CSS grid desktop view.
 *
 * Mobile structure:
 *   .mobile-schedule
 *     .schedule-day
 *       .mobile-schedule-day > h3 "Saturday"
 *       .mobile-time "12:00 - 2:00 pm"
 *       .mobile-classes > .mobile-day-class.OpenMat "Open Mat"
 */
export const kicksiteParser: ScheduleParser = {
  name: 'kicksite',

  detect(html: string): DetectionResult {
    const signals: string[] = [];
    const lower = html.toLowerCase();

    if (lower.includes('powered by kicksite')) signals.push('footer_branding');
    if (html.includes('mobile-schedule')) signals.push('mobile_schedule');
    if (html.includes('schedule-container')) signals.push('schedule_container');
    if (html.includes('page-section-schedule')) signals.push('page_section');

    const detected = signals.length >= 2;
    const confidence = Math.min(1.0, signals.length * 0.3);

    return { detected, confidence, signals };
  },

  extract(html: string): ExtractedOpenMat[] {
    const $ = cheerio.load(html);
    const results: ExtractedOpenMat[] = [];

    // Use the mobile schedule view — cleaner structure
    const mobileSchedule = $('.mobile-schedule');
    if (mobileSchedule.length === 0) return results;

    let currentDay = -1;

    mobileSchedule.find('.schedule-day').each((_, daySection) => {
      const $day = $(daySection);

      // Get day name from h3
      const dayName = $day.find('.mobile-schedule-day h3').first().text().trim().toLowerCase();
      if (dayName in DAY_MAP) {
        currentDay = DAY_MAP[dayName];
      } else {
        return; // skip if we can't determine the day
      }

      // Iterate through time + class pairs
      // Structure: .mobile-time followed by .mobile-classes
      const times = $day.find('.mobile-time');
      const classGroups = $day.find('.mobile-classes');

      times.each((i, timeEl) => {
        const timeText = $(timeEl).text().trim();
        const classGroup = classGroups.eq(i);

        classGroup.find('[class*="mobile-day-class"]').each((_, classEl) => {
          const className = $(classEl).text().trim();

          if (isOpenMatKeyword(className)) {
            const { startTime, endTime } = parseTimeRange(timeText);
            if (startTime) {
              results.push({
                className,
                dayOfWeek: currentDay,
                startTime,
                endTime,
                rawText: `${dayName} ${timeText} - ${className}`,
              });
            }
          }
        });
      });
    });

    return results;
  },
};
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/lib/extraction/__tests__/kicksite.test.ts
```

Expected: PASS (all 4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/extraction/parsers/ src/lib/extraction/__tests__/kicksite.test.ts src/lib/extraction/__tests__/fixtures/
git commit -m "feat: add Kicksite parser with mobile schedule extraction"
```

### Task 10: Build Generic HTML Parser

**Files:**
- Create: `src/lib/extraction/parsers/generic-html.ts`
- Create: `src/lib/extraction/__tests__/generic-html.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/extraction/__tests__/generic-html.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { genericHtmlParser } from '../parsers/generic-html';

describe('Generic HTML Parser', () => {
  describe('detect', () => {
    it('detects a table with day headers', () => {
      const html = `<html><body>
        <table>
          <tr><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Thursday</th><th>Friday</th><th>Saturday</th></tr>
          <tr><td>BJJ Fundamentals</td><td>No Gi</td><td>BJJ Fundamentals</td><td>No Gi</td><td>Competition</td><td>Open Mat 10:00-12:00</td></tr>
        </table>
      </body></html>`;
      const result = genericHtmlParser.detect(html);
      expect(result.detected).toBe(true);
    });

    it('does not detect a page without schedule structure', () => {
      const html = '<html><body><p>Welcome to our gym!</p></body></html>';
      const result = genericHtmlParser.detect(html);
      expect(result.detected).toBe(false);
    });
  });

  describe('extract', () => {
    it('extracts open mat from table cell', () => {
      const html = `<html><body>
        <table>
          <tr><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Thursday</th><th>Friday</th><th>Saturday</th></tr>
          <tr><td>BJJ Fundamentals 9:00 am</td><td>No Gi 9:00 am</td><td></td><td></td><td></td><td>Open Mat 10:00 - 12:00 pm</td></tr>
        </table>
      </body></html>`;
      const results = genericHtmlParser.extract(html);
      expect(results.length).toBeGreaterThanOrEqual(1);

      const openMat = results[0];
      expect(openMat.dayOfWeek).toBe(6); // Saturday
      expect(openMat.startTime).toBe('10:00');
      expect(openMat.endTime).toBe('12:00');
    });

    it('returns empty array when no open mat keywords found', () => {
      const html = `<html><body>
        <table>
          <tr><th>Monday</th><th>Tuesday</th></tr>
          <tr><td>BJJ Fundamentals</td><td>No Gi</td></tr>
        </table>
      </body></html>`;
      const results = genericHtmlParser.extract(html);
      expect(results).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/extraction/__tests__/generic-html.test.ts
```

Expected: FAIL — module `../parsers/generic-html` not found.

- [ ] **Step 3: Write implementation**

Create `src/lib/extraction/parsers/generic-html.ts`:
```typescript
import * as cheerio from 'cheerio';
import type { ScheduleParser, DetectionResult, ExtractedOpenMat } from '../types';
import { isOpenMatKeyword, parseTimeRange } from './shared';

const DAY_NAMES: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2,
  wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

/**
 * Generic HTML parser — scans any HTML for tables containing
 * day-of-week headers and open mat keywords in cells.
 * Lower confidence than platform-specific parsers.
 */
export const genericHtmlParser: ScheduleParser = {
  name: 'generic-html',

  detect(html: string): DetectionResult {
    const $ = cheerio.load(html);
    const signals: string[] = [];

    // Look for tables with day headers
    $('table').each((_, table) => {
      const headerText = $(table).find('th, thead td').text().toLowerCase();
      const dayCount = Object.keys(DAY_NAMES).filter((d) => headerText.includes(d)).length;
      if (dayCount >= 3) signals.push('table_with_day_headers');
    });

    // Also check for list/div structures with day names
    const bodyText = $('body').text().toLowerCase();
    const daysPresent = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      .filter((d) => bodyText.includes(d));
    if (daysPresent.length >= 3 && bodyText.includes('open mat')) {
      signals.push('day_names_with_open_mat_keyword');
    }

    const detected = signals.length > 0;
    return { detected, confidence: detected ? 0.5 : 0, signals };
  },

  extract(html: string): ExtractedOpenMat[] {
    const $ = cheerio.load(html);
    const results: ExtractedOpenMat[] = [];

    // Strategy: find tables with day-name headers, scan cells for open mat keywords
    $('table').each((_, table) => {
      const $table = $(table);
      const headers: number[] = []; // maps column index → dayOfWeek

      // Map header columns to days
      $table.find('tr').first().find('th, td').each((colIdx, cell) => {
        const text = $(cell).text().trim().toLowerCase();
        for (const [name, day] of Object.entries(DAY_NAMES)) {
          if (text.includes(name)) {
            headers[colIdx] = day;
            break;
          }
        }
      });

      if (headers.filter((h) => h !== undefined).length < 3) return; // not a schedule table

      // Scan data rows for open mat keywords
      $table.find('tr').slice(1).each((_, row) => {
        $(row).find('td').each((colIdx, cell) => {
          const cellText = $(cell).text().trim();
          if (!isOpenMatKeyword(cellText)) return;

          const dayOfWeek = headers[colIdx];
          if (dayOfWeek === undefined) return;

          const { startTime, endTime } = parseTimeRange(cellText);

          // Skip if no parseable time found — can't create a useful listing without a time
          if (!startTime) return;

          results.push({
            className: cellText.replace(/\d{1,2}:\d{2}\s*(am|pm)?\s*[-–]?\s*\d{0,2}:?\d{0,2}\s*(am|pm)?/gi, '').trim() || cellText,
            dayOfWeek,
            startTime,
            endTime,
            rawText: cellText,
          });
        });
      });
    });

    return results;
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/extraction/__tests__/generic-html.test.ts
```

Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/extraction/parsers/generic-html.ts src/lib/extraction/__tests__/generic-html.test.ts
git commit -m "feat: add generic HTML table parser for open mat extraction"
```

### Task 11: Build Parser Registry and Platform Detection (Stage 3)

**Files:**
- Create: `src/lib/extraction/parsers/registry.ts`
- Create: `src/lib/extraction/detect-platform.ts`

- [ ] **Step 1: Write parser registry**

Create `src/lib/extraction/parsers/registry.ts`:
```typescript
import type { ScheduleParser } from '../types';
import { kicksiteParser } from './kicksite';
import { genericHtmlParser } from './generic-html';

/**
 * Ordered list of parsers. Platform-specific parsers run first
 * (higher confidence). Generic parser is always last (fallback).
 */
export const parsers: ScheduleParser[] = [
  kicksiteParser,
  genericHtmlParser,
];
```

- [ ] **Step 2: Write platform detection (Stage 3)**

Create `src/lib/extraction/detect-platform.ts`:
```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/extraction/parsers/registry.ts src/lib/extraction/detect-platform.ts
git commit -m "feat: add parser registry and Stage 3 platform detection"
```

---

## Chunk 4: Stage 5-6 — Validate, Save, and Pipeline Orchestrator

### Task 12: Build Stage 5 — Validate and Normalize

**Files:**
- Create: `src/lib/extraction/validate.ts`
- Create: `src/lib/extraction/__tests__/validate.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/extraction/__tests__/validate.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { validateAndNormalize } from '../validate';
import type { ExtractedOpenMat } from '../types';

describe('validateAndNormalize', () => {
  const baseExtracted: ExtractedOpenMat = {
    className: 'Open Mat',
    dayOfWeek: 6,
    startTime: '12:00',
    endTime: '14:00',
    rawText: 'Saturday 12:00 - 2:00 pm - Open Mat',
  };

  it('normalizes a valid open mat', () => {
    const results = validateAndNormalize(
      [baseExtracted],
      'gym-123',
      'https://example.com/schedule',
      0.9,
      false
    );
    expect(results).toHaveLength(1);
    expect(results[0].day_of_week).toBe(6);
    expect(results[0].start_time).toBe('12:00:00');
    expect(results[0].end_time).toBe('14:00:00');
    expect(results[0].type).toBe('both');
    expect(results[0].confidence_score).toBe('medium');
    expect(results[0].source_type).toBe('website_scrape');
  });

  it('defaults end_time to start + 2h when null', () => {
    const noEnd = { ...baseExtracted, endTime: null };
    const results = validateAndNormalize([noEnd], 'gym-123', 'https://example.com/schedule', 0.9, false);
    expect(results[0].end_time).toBe('14:00:00');
  });

  it('detects nogi from class name', () => {
    const nogi = { ...baseExtracted, className: 'No Gi Open Mat' };
    const results = validateAndNormalize([nogi], 'gym-123', 'https://example.com/schedule', 0.9, false);
    expect(results[0].type).toBe('nogi');
  });

  it('detects kids open mat', () => {
    const kids = { ...baseExtracted, className: 'Kids Open Mat' };
    const results = validateAndNormalize([kids], 'gym-123', 'https://example.com/schedule', 0.9, false);
    expect(results[0].age_policy).toBe('kids_separate');
  });

  it('filters out invalid times', () => {
    const badTime = { ...baseExtracted, startTime: '25:00' };
    const results = validateAndNormalize([badTime], 'gym-123', 'https://example.com/schedule', 0.9, false);
    expect(results).toHaveLength(0);
  });

  it('maps low confidence for generic parser', () => {
    const results = validateAndNormalize([baseExtracted], 'gym-123', 'https://example.com/schedule', 0.5, false);
    expect(results[0].confidence_score).toBe('low');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/extraction/__tests__/validate.test.ts
```

Expected: FAIL — module `../validate` not found.

- [ ] **Step 3: Write implementation**

Create `src/lib/extraction/validate.ts`:
```typescript
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
    // Validate start time
    const startTime = normalizeTime(item.startTime);
    if (!startTime || !isValidTime(startTime) || !isReasonableTime(startTime)) continue;

    // Default end time to start + 2h if missing
    let endTime = item.endTime ? normalizeTime(item.endTime) : null;
    if (!endTime) {
      endTime = addHours(startTime, 2);
    }
    if (!isValidTime(endTime)) continue;

    // Ensure start < end
    if (startTime >= endTime) continue;

    // Detect mat type from keywords
    const type = detectMatType(item.className);

    // Detect age policy
    const agePolicy = detectAgePolicy(item.className);

    // Map parser confidence to enum
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
  // Already in HH:MM format
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
  return h >= 5 && h <= 23; // 5:00 AM to 11:00 PM
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/extraction/__tests__/validate.test.ts
```

Expected: PASS (all 6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/extraction/validate.ts src/lib/extraction/__tests__/validate.test.ts
git commit -m "feat: add Stage 5 validation with time normalization and keyword detection"
```

### Task 13: Build Pipeline Orchestrator

**Files:**
- Create: `src/lib/extraction/pipeline.ts`

- [ ] **Step 1: Write the pipeline orchestrator**

Create `src/lib/extraction/pipeline.ts`:
```typescript
import { fetchPage } from './fetch';
import { discoverScheduleUrl } from './discover-schedule';
import { detectPlatform, getParser } from './detect-platform';
import { validateAndNormalize } from './validate';
import type { PipelineResult, ValidatedOpenMat } from './types';

interface PipelineOptions {
  gymId: string;
  gymName: string;
  websiteUrl: string;
  needsReview: boolean; // true for bulk, false for admin-reviewed
}

/**
 * Main extraction pipeline orchestrator.
 * Runs all 6 stages sequentially for a single gym.
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
    result.success = true; // Not an error — gym just doesn't have open mats
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
  // Note: savedCount stays 0 until caller actually saves to DB
  result.extractedCount = extracted.length;
  result.success = true;
  result.stage = 'save'; // ready for Stage 6

  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/extraction/pipeline.ts
git commit -m "feat: add pipeline orchestrator running stages 1-5"
```

---

## Chunk 5: API Route, Bulk Script, and Admin Dashboard

### Task 14: Build extraction API route

**Files:**
- Create: `src/app/api/extract/route.ts`

- [ ] **Step 1: Write the API route**

Create `src/app/api/extract/route.ts`:
```typescript
import { type NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { runExtractionPipeline } from '@/lib/extraction/pipeline';

/**
 * POST /api/extract
 * Runs the extraction pipeline for a single gym.
 * Admin-only (caller must verify auth).
 *
 * Body: { gym_id: string }
 * Response: PipelineResult (including extracted open mats for review)
 */
export async function POST(request: NextRequest) {
  let gymId: string;

  try {
    const body = await request.json();
    gymId = body.gym_id;
    if (!gymId) {
      return NextResponse.json({ error: 'gym_id is required' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Fetch gym details
  const { data: gym, error: gymError } = await supabase
    .from('gyms')
    .select('id, name, website')
    .eq('id', gymId)
    .single();

  if (gymError || !gym) {
    return NextResponse.json({ error: 'Gym not found' }, { status: 404 });
  }

  if (!gym.website) {
    return NextResponse.json({ error: 'Gym has no website URL' }, { status: 400 });
  }

  // Run extraction pipeline (stages 1-5)
  const result = await runExtractionPipeline({
    gymId: gym.id,
    gymName: gym.name,
    websiteUrl: gym.website,
    needsReview: false, // Admin-triggered = reviewed
  });

  // Update gym metadata regardless of outcome
  await supabase.from('gyms').update({
    platform_type: result.platform ?? null,
    schedule_page_url: result.scheduleUrl ?? null,
    schedule_format: result.platform ? 'structured_html' : null,
    last_scraped_at: new Date().toISOString(),
    scrape_status: result.success
      ? (result.extractedCount > 0 ? 'success' : 'no_open_mats')
      : (result.error?.includes('No schedule') ? 'no_schedule' : 'failed'),
    scrape_error: result.error ?? null,
  }).eq('id', gymId);

  return NextResponse.json(result);
}

/**
 * PUT /api/extract
 * Saves extracted open mats to the database after admin review.
 *
 * Body: { gym_id: string, open_mats: ValidatedOpenMat[] }
 */
export async function PUT(request: NextRequest) {
  let gymId: string;
  let openMats: Record<string, unknown>[];

  try {
    const body = await request.json();
    gymId = body.gym_id;
    openMats = body.open_mats;
    if (!gymId || !openMats?.length) {
      return NextResponse.json({ error: 'gym_id and open_mats are required' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Delete existing scraped open mats for this gym
  await supabase
    .from('open_mats')
    .delete()
    .eq('gym_id', gymId)
    .eq('source_type', 'website_scrape');

  // Insert new ones
  const { error: insertError, count } = await supabase
    .from('open_mats')
    .insert(openMats);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Update gym scrape status
  await supabase.from('gyms').update({
    scrape_status: 'success',
    scrape_error: null,
  }).eq('id', gymId);

  return NextResponse.json({ saved: count ?? openMats.length });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/extract/route.ts
git commit -m "feat: add extraction API route with review gate"
```

### Task 15: Build bulk extraction script

**Files:**
- Create: `scripts/extract-all.ts`
- Create: `scripts/extract-gym.ts`

- [ ] **Step 1: Write single-gym extraction script**

Create `scripts/extract-gym.ts`:
```typescript
/**
 * Extract open mats from a single gym's website.
 * Usage: npx tsx scripts/extract-gym.ts <gym-id>
 */
import 'dotenv/config';
import { createServiceClient } from '../src/lib/supabase/service';
import { runExtractionPipeline } from '../src/lib/extraction/pipeline';

async function main() {
  const gymId = process.argv[2];
  if (!gymId) {
    console.error('Usage: npx tsx scripts/extract-gym.ts <gym-id>');
    process.exit(1);
  }

  const supabase = createServiceClient();

  const { data: gym } = await supabase
    .from('gyms')
    .select('id, name, website')
    .eq('id', gymId)
    .single();

  if (!gym) {
    console.error(`Gym ${gymId} not found`);
    process.exit(1);
  }

  if (!gym.website) {
    console.error(`Gym "${gym.name}" has no website`);
    process.exit(1);
  }

  console.log(`\nExtracting: ${gym.name} (${gym.website})`);
  const result = await runExtractionPipeline({
    gymId: gym.id,
    gymName: gym.name,
    websiteUrl: gym.website,
    needsReview: false,
  });

  // Update gym metadata
  await supabase.from('gyms').update({
    platform_type: result.platform ?? null,
    schedule_page_url: result.scheduleUrl ?? null,
    schedule_format: result.platform ? 'structured_html' : null,
    last_scraped_at: new Date().toISOString(),
    scrape_status: result.success
      ? (result.extractedCount > 0 ? 'success' : 'no_open_mats')
      : (result.error?.includes('No schedule') ? 'no_schedule' : 'failed'),
    scrape_error: result.error ?? null,
  }).eq('id', gym.id);

  console.log(`  Stage: ${result.stage}`);
  console.log(`  Platform: ${result.platform ?? 'unknown'}`);
  console.log(`  Schedule URL: ${result.scheduleUrl ?? 'none'}`);
  console.log(`  Extracted: ${result.extractedCount} open mats`);
  console.log(`  Validated: ${result.savedCount} open mats`);

  if (result.error) {
    console.log(`  Error: ${result.error}`);
  }

  if (result.openMats.length > 0) {
    console.log('\n  Open Mats Found:');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (const om of result.openMats) {
      console.log(`    ${days[om.day_of_week]} ${om.start_time}-${om.end_time} (${om.type}) [${om.confidence_score}]`);
    }
  }
}

main().catch(console.error);
```

- [ ] **Step 2: Write bulk extraction script**

Create `scripts/extract-all.ts`:
```typescript
/**
 * Run extraction pipeline for ALL gyms with websites.
 * Usage: npx tsx scripts/extract-all.ts [--save]
 *
 * Without --save: dry run, shows what would be extracted
 * With --save: saves extracted open mats to database with needs_review=true
 */
import 'dotenv/config';
import { createServiceClient } from '../src/lib/supabase/service';
import { runExtractionPipeline } from '../src/lib/extraction/pipeline';

async function main() {
  const shouldSave = process.argv.includes('--save');
  const supabase = createServiceClient();

  // Fetch all gyms with websites
  const { data: gyms, error } = await supabase
    .from('gyms')
    .select('id, name, website')
    .not('website', 'is', null)
    .order('name');

  if (error || !gyms) {
    console.error('Failed to fetch gyms:', error?.message);
    process.exit(1);
  }

  console.log(`Found ${gyms.length} gyms with websites`);
  console.log(shouldSave ? 'Mode: SAVE (will write to database)\n' : 'Mode: DRY RUN (no database writes)\n');

  const stats = {
    total: gyms.length,
    success: 0,
    noSchedule: 0,
    noOpenMats: 0,
    failed: 0,
    totalOpenMats: 0,
  };

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 0; i < gyms.length; i++) {
    const gym = gyms[i];
    if (!gym.website) continue;

    process.stdout.write(`[${i + 1}/${gyms.length}] ${gym.name}... `);

    const result = await runExtractionPipeline({
      gymId: gym.id,
      gymName: gym.name,
      websiteUrl: gym.website,
      needsReview: true,
    });

    // Update gym metadata
    await supabase.from('gyms').update({
      platform_type: result.platform ?? null,
      schedule_page_url: result.scheduleUrl ?? null,
      schedule_format: result.platform ? 'structured_html' : null,
      last_scraped_at: new Date().toISOString(),
      scrape_status: result.success
        ? (result.extractedCount > 0 ? 'success' : 'no_open_mats')
        : (result.error?.includes('No schedule') ? 'no_schedule' : 'failed'),
      scrape_error: result.error ?? null,
    }).eq('id', gym.id);

    if (result.openMats.length > 0) {
      stats.success++;
      stats.totalOpenMats += result.openMats.length;
      console.log(`✓ ${result.openMats.length} open mats (${result.platform})`);

      for (const om of result.openMats) {
        console.log(`    ${days[om.day_of_week]} ${om.start_time}-${om.end_time} (${om.type})`);
      }

      if (shouldSave) {
        // Delete existing scraped open mats
        await supabase
          .from('open_mats')
          .delete()
          .eq('gym_id', gym.id)
          .eq('source_type', 'website_scrape');

        // Insert new ones
        const { error: insertErr } = await supabase
          .from('open_mats')
          .insert(result.openMats);

        if (insertErr) {
          console.log(`    ⚠ Save failed: ${insertErr.message}`);
        }
      }
    } else if (result.error?.includes('No schedule')) {
      stats.noSchedule++;
      console.log('— no schedule page');
    } else if (result.success && result.extractedCount === 0) {
      stats.noOpenMats++;
      console.log('— schedule found, no open mats');
    } else {
      stats.failed++;
      console.log(`✗ ${result.error}`);
    }

    // Be polite — 500ms delay between gyms
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('\n========== SUMMARY ==========');
  console.log(`Total gyms:       ${stats.total}`);
  console.log(`Open mats found:  ${stats.success} gyms, ${stats.totalOpenMats} total sessions`);
  console.log(`No schedule page: ${stats.noSchedule}`);
  console.log(`No open mats:     ${stats.noOpenMats}`);
  console.log(`Failed:           ${stats.failed}`);
}

main().catch(console.error);
```

- [ ] **Step 3: Install tsx for running TypeScript scripts**

```bash
npm install -D tsx dotenv
```

- [ ] **Step 4: Add script commands to package.json**

Add to `"scripts"`:
```json
"extract:all": "tsx scripts/extract-all.ts",
"extract:all:save": "tsx scripts/extract-all.ts --save",
"extract:gym": "tsx scripts/extract-gym.ts"
```

- [ ] **Step 5: Commit**

```bash
git add scripts/ package.json package-lock.json
git commit -m "feat: add bulk and single-gym extraction scripts"
```

### Task 16: Add Extraction tab to Admin Dashboard

**Files:**
- Create: `src/components/admin/ExtractionTab.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Create ExtractionTab component**

Create `src/components/admin/ExtractionTab.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Gym } from '@/lib/types';
import type { PipelineResult } from '@/lib/extraction/types';
import { CalendarDays, Globe, Loader2, Search, CheckCircle, XCircle, Save } from 'lucide-react';

interface GymWithExtraction extends Gym {
  open_mat_count: number;
}

interface ExtractionTabProps {
  gyms: GymWithExtraction[];
  onRefresh: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  no_schedule: 'bg-gray-100 text-gray-600',
  no_open_mats: 'bg-yellow-100 text-yellow-800',
  needs_review: 'bg-blue-100 text-blue-800',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ExtractionTab({ gyms, onRefresh }: ExtractionTabProps) {
  const [scraping, setScraping] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [saving, setSaving] = useState(false);

  const gymsWithWebsite = gyms.filter((g) => g.website);
  const scraped = gymsWithWebsite.filter((g) => g.scrape_status);
  const successCount = scraped.filter((g) => g.scrape_status === 'success').length;
  const failedCount = scraped.filter((g) => g.scrape_status === 'failed').length;
  const noScheduleCount = scraped.filter((g) => g.scrape_status === 'no_schedule').length;
  const noOpenMatsCount = scraped.filter((g) => g.scrape_status === 'no_open_mats').length;
  const needsReviewCount = scraped.filter((g) => g.scrape_status === 'needs_review').length;

  async function handleScrape(gymId: string) {
    setScraping(gymId);
    setResult(null);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gym_id: gymId }),
      });
      const data = await res.json();
      setResult(data);
      onRefresh();
    } catch {
      setResult({ success: false, error: 'Network error', stage: 'fetch', extractedCount: 0, savedCount: 0, openMats: [], gymId, gymName: '' } as PipelineResult);
    }
    setScraping(null);
  }

  async function handleSave(gymId: string) {
    if (!result?.openMats.length) return;
    setSaving(true);
    try {
      await fetch('/api/extract', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gym_id: gymId, open_mats: result.openMats }),
      });
      setResult(null);
      onRefresh();
    } catch {
      // silent
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold">{gymsWithWebsite.length}</p>
          <p className="text-xs text-gray-500">With Website</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-green-600">{successCount}</p>
          <p className="text-xs text-gray-500">Open Mats Found</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-red-600">{failedCount}</p>
          <p className="text-xs text-gray-500">Failed</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-gray-500">{noScheduleCount}</p>
          <p className="text-xs text-gray-500">No Schedule</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{noOpenMatsCount}</p>
          <p className="text-xs text-gray-500">No Open Mats</p>
        </CardContent></Card>
      </div>

      {/* Review Gate — shows when a scrape result needs review */}
      {result && result.openMats.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              Found {result.openMats.length} open mat{result.openMats.length > 1 ? 's' : ''} at {result.gymName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              {result.openMats.map((om, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <Badge variant="default">{DAYS[om.day_of_week]}</Badge>
                  <span>{om.start_time.slice(0, 5)} - {om.end_time.slice(0, 5)}</span>
                  <Badge className={om.type === 'nogi' ? 'bg-purple-100 text-purple-800' : om.type === 'gi' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}>{om.type}</Badge>
                  <Badge className={`text-xs ${om.confidence_score === 'medium' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {om.confidence_score}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                disabled={saving}
                onClick={() => handleSave(result.gymId)}
              >
                <Save className="mr-1 h-4 w-4" />
                {saving ? 'Saving...' : 'Save to Database'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setResult(null)}
              >
                <XCircle className="mr-1 h-4 w-4" />
                Discard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gym Table with scrape controls */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Gym</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Schedule URL</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Open Mats</th>
              <th className="px-4 py-3 text-center">Last Scraped</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {gymsWithWebsite.map((gym) => (
              <tr key={gym.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{gym.name}</div>
                  <div className="text-xs text-gray-400">{gym.city}, {gym.state}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{gym.platform_type ?? '—'}</td>
                <td className="px-4 py-3">
                  {gym.schedule_page_url ? (
                    <a href={gym.schedule_page_url} target="_blank" rel="noopener noreferrer"
                       className="text-blue-600 hover:underline text-xs truncate block max-w-[200px]">
                      {gym.schedule_page_url.replace(/https?:\/\//, '')}
                    </a>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {gym.scrape_status ? (
                    <Badge className={STATUS_COLORS[gym.scrape_status] ?? 'bg-gray-100'}>
                      {gym.scrape_status.replace('_', ' ')}
                    </Badge>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">{gym.open_mat_count}</td>
                <td className="px-4 py-3 text-center text-xs text-gray-400">
                  {gym.last_scraped_at
                    ? new Date(gym.last_scraped_at).toLocaleDateString()
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={scraping === gym.id}
                    onClick={() => handleScrape(gym.id)}
                  >
                    {scraping === gym.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add Extraction tab to admin page**

In `src/app/admin/page.tsx`:

Add import at top:
```typescript
import ExtractionTab from '@/components/admin/ExtractionTab';
```

Update the `Tab` type (line 24):
```typescript
type Tab = 'pending' | 'claims' | 'gyms' | 'reports' | 'extraction';
```

Add to the `tabs` array (around line 302-307):
```typescript
{ key: 'extraction', label: 'Extraction' },
```

Add the tab content after the reports section (before the closing `</>`):
```typescript
{activeTab === 'extraction' && (
  <ExtractionTab
    gyms={gyms}
    onRefresh={() => Promise.all([fetchStats(), fetchGyms()])}
  />
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ExtractionTab.tsx src/app/admin/page.tsx
git commit -m "feat: add Extraction tab to admin dashboard with review gate"
```

---

## Chunk 6: Integration Test and First Run

### Task 17: End-to-end test with real Kicksite gym

- [ ] **Step 1: Run single-gym extraction against Carlson Gracie GV**

First, find the gym ID:
```bash
npx tsx -e "
  import 'dotenv/config';
  import { createServiceClient } from './src/lib/supabase/service';
  const supabase = createServiceClient();
  const r = await supabase.from('gyms').select('id, name').ilike('name', '%carlson%');
  console.log(r.data);
"
```

Then run extraction:
```bash
npm run extract:gym -- <gym-id>
```

Expected output:
```
Extracting: Carlson Gracie Green Valley (https://carlsongraciegreenvalley.com)
  Stage: save
  Platform: kicksite
  Schedule URL: https://carlsongraciegreenvalley.com/schedule/
  Extracted: 1 open mats
  Validated: 1 open mats

  Open Mats Found:
    Sat 12:00:00-14:00:00 (both) [medium]
```

- [ ] **Step 2: Run dry-run bulk extraction**

```bash
npm run extract:all
```

Review the output. This will show extraction results for all ~214 gyms without saving anything.

- [ ] **Step 3: Run bulk extraction with save (if dry run looks good)**

```bash
npm run extract:all:save
```

- [ ] **Step 4: Verify in admin dashboard**

Navigate to `/admin` → "Extraction" tab. Should show:
- Stats bar with counts for each status
- Gym table with platform types, schedule URLs, and scrape statuses populated

- [ ] **Step 5: Verify in search**

Search for a location (e.g., "Henderson, NV 89052"). Gyms with extracted open mats should now show schedule details instead of "No open mat schedule yet."

- [ ] **Step 6: Commit any fixes**

If any issues were found during testing, fix them and commit:
```bash
git add -A
git commit -m "fix: address issues found during extraction pipeline integration testing"
```

### Task 18: Deploy to Vercel

- [ ] **Step 1: Add SUPABASE_SERVICE_ROLE_KEY to Vercel environment variables**

```bash
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

- [ ] **Step 2: Deploy**

```bash
vercel --prod
```

- [ ] **Step 3: Verify admin dashboard works in production**

Navigate to the production URL `/admin` → "Extraction" tab. Test scraping a single gym.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: extraction pipeline complete — Tier A parsers, admin dashboard, bulk scripts"
```
