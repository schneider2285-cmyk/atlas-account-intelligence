# Schedule Extraction Pipeline — Design Spec

**Date:** 2026-03-25
**Status:** Draft
**Goal:** Automatically extract open mat schedules from gym websites and populate the `open_mats` table, turning 214 empty gym shells into actionable listings.

---

## Problem

We have ~214 discovered gyms with website URLs but zero open mat schedules. Every search result says "No open mat schedule yet." The product's core value — answering "where can I roll this weekend?" — requires schedule data. Community submissions alone won't scale fast enough. We need automated extraction.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Execution model | Hybrid: API route (single gym) + standalone script (bulk) | Admin can re-scrape individual gyms from the panel; bulk runs exceed Vercel's 60s timeout |
| Tier scope | Tier A only (structured HTML). Defer OCR/vision (Tier B) and social (Tier C) | Ship fast, measure how many gyms need OCR before investing in it |
| Schedule page discovery | Convention probing first, homepage link crawl fallback | Probing catches 70%+ of cases instantly; crawl handles edge cases |
| Internal architecture | Pipeline stages + parser registry | Clear logging/status per stage for admin dashboard; parsers are isolated, testable modules |
| Admin experience | Dashboard with status view + scrape button + review gate for previews | Visibility into pipeline health; review gate prevents bad data on first runs |
| Vision/OCR service | Deferred — will evaluate Claude Vision when Tier B is needed | Don't know what % of gyms need OCR yet |

## Pipeline Architecture

### Overview

Six stages, executed sequentially per gym. Each stage is a pure function (input → output) except Stage 6 (Save) which writes to the database.

```
Fetch → Discover Schedule URL → Detect Platform → Extract Open Mats → Validate → Save
```

### Stage 1: Fetch

- **Input:** `gym.website` URL
- **Action:** HTTP GET with 10s timeout, follow redirects, set `User-Agent: BJJOpenMatFinder/1.0`
- **Output:** `{ html: string, statusCode: number, finalUrl: string }` or error
- **Error cases:** timeout, DNS failure, 404, non-HTML response (PDF, etc.)

### Stage 2: Discover Schedule URL

- **Input:** homepage HTML + base URL
- **Action:**
  1. **Convention probing:** Try appending common paths to the base URL: `/schedule`, `/class-schedule`, `/classes`, `/timetable`, `/programs`, `/weekly-schedule`. For each, HEAD request first (fast), then GET if 200.
  2. **Homepage link crawl (fallback):** If no convention URL hits, parse homepage HTML for `<a>` tags. Score links by keyword match in `href` and anchor text: "schedule", "class", "timetable", "program", "calendar". Follow the highest-scoring link.
  3. **Homepage as schedule (fallback):** Some single-page gyms embed the schedule on the homepage. If no schedule URL found, check if the homepage itself contains schedule-like content.
- **Output:** `{ scheduleUrl: string, scheduleHtml: string }` or `null` (no schedule page found)

### Stage 3: Detect Platform

- **Input:** schedule page HTML
- **Action:** Run each registered parser's `detect(html)` function. Return the parser with the highest confidence score above a threshold (0.5).
- **Output:** `{ platform: string, parser: ScheduleParser, confidence: number }` or `{ platform: 'unknown' }`
- **Detection signals by platform:**
  - **Kicksite:** Footer contains "Powered by Kicksite", `.page-section-schedule` element exists, `.schedule-container` with `data-colnum` attribute
  - **Generic HTML:** Fallback — any HTML page with a `<table>` or grid structure containing day-of-week headers and time patterns

### Stage 4: Extract Open Mats (Parser Registry)

- **Input:** schedule page HTML + detected parser
- **Action:** Delegate to the platform-specific parser's `extract(html)` function
- **Output:** `ExtractedOpenMat[]` — may be empty (gym has schedule but no open mats listed)
- **Open mat keyword matching** (used by all parsers):
  - Include: "open mat", "open roll", "free roll", "open training", "open gym"
  - Exclude: "open enrollment", "open house", "open door" (marketing, not rolling)
  - Case-insensitive matching
  - "Adult Open Mat" vs "Kids Open Mat" — flag `age_policy` accordingly

### Stage 5: Validate & Normalize

- **Input:** `ExtractedOpenMat[]`
- **Action:**
  - Validate times: `start_time < end_time`, within reasonable hours (5:00 AM – 11:00 PM)
  - Normalize day names to `day_of_week` (0=Sunday, 6=Saturday)
  - Detect `mat_type` from keywords: "gi" → gi, "no-gi"/"nogi" → nogi, ambiguous → both
  - Detect "kids" / "children" / "youth" → `age_policy: 'kids_separate'`
  - Set `confidence_score` based on parser confidence + platform reliability
  - Set `source_type: 'website_scrape'`
- **Output:** `ValidatedOpenMat[]` with all fields normalized to database schema

### Stage 6: Save

- **Input:** `ValidatedOpenMat[]` + `gym_id`
- **Action (API route — single gym):**
  1. Return extracted data as JSON preview to the admin UI
  2. Admin reviews and clicks "Save" or "Discard"
  3. On save: upsert into `open_mats`, update `gyms.last_scraped_at`, `gyms.platform_type`, `gyms.schedule_page_url`, `gyms.scrape_status`
- **Action (bulk script):**
  1. Auto-save with `needs_review: true` flag
  2. Update gym metadata fields
  3. Log results to stdout
- **Output:** `{ saved: number, skipped: number, errors: string[] }`

## Parser Registry

### Interface

```typescript
interface ScheduleParser {
  name: string;
  detect(html: string): DetectionResult;
  extract(html: string): ExtractedOpenMat[];
}

interface DetectionResult {
  detected: boolean;
  confidence: number; // 0.0 - 1.0
  signals: string[];  // what was detected, for logging
}

interface ExtractedOpenMat {
  className: string;        // raw class name from source, e.g. "Adult Open Mat"
  dayOfWeek: number;        // 0-6
  startTime: string;        // HH:MM (24h)
  endTime: string | null;   // HH:MM (24h) or null if not found
  rawText: string;          // original text for debugging
}
```

### Parsers (initial set)

**1. Kicksite Parser** (`parsers/kicksite.ts`)
- Detect: footer "Powered by Kicksite" OR `.page-section-schedule` element
- Extract:
  1. Find `.schedule-container` and read `data-colnum` for column count
  2. Map `.class-day` elements to day names → day indices
  3. For each `.grow-class` element, check if className contains open mat keywords
  4. Extract time from tooltip/description text within the element
  5. Determine day by grid position: `column_index = element_position % column_count`
- Test case: Carlson Gracie Green Valley (carlsongraciegreenvalley.com/schedule/)

**2. Generic HTML Parser** (`parsers/generic-html.ts`)
- Detect: any HTML with `<table>` containing day-of-week headers, or structured `<div>` grid with time patterns
- Extract:
  1. Find tables/grids with day headers (Mon, Tue, Wed... or Monday, Tuesday...)
  2. Scan each cell for open mat keywords
  3. Extract time from cell content using regex patterns (`\d{1,2}:\d{2}\s*(am|pm)?`)
  4. Map cell position to day based on column index
- Lower confidence than platform-specific parsers (0.5 vs 0.9)

## File Structure

```
src/lib/extraction/
├── pipeline.ts            # Main orchestrator — runs stages 1-6
├── fetch.ts               # Stage 1: HTTP fetch
├── discover-schedule.ts   # Stage 2: URL probing + link crawling
├── detect-platform.ts     # Stage 3: Run parser detection
├── validate.ts            # Stage 5: Normalize and validate
├── types.ts               # Shared types
│
├── parsers/
│   ├── registry.ts        # Maps platform names → parser modules
│   ├── kicksite.ts        # Kicksite-specific parser
│   └── generic-html.ts    # Fallback HTML parser

scripts/
├── extract-all.ts         # Bulk: iterate all gyms with websites
└── extract-gym.ts         # Single gym: for testing/debugging

src/app/api/extract/
└── route.ts               # POST /api/extract — admin-triggered single gym extraction

src/app/admin/
└── page.tsx               # Enhanced with extraction dashboard tab
```

## Schema Changes

### Migration 003: Extraction Pipeline

**Add to `gyms` table:**

```sql
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS platform_type text;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS schedule_page_url text;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS schedule_format text;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS last_scraped_at timestamptz;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS scrape_status text;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS scrape_error text;
```

- `platform_type`: kicksite, zenplanner, mindbody, elementor, squarespace, custom, unknown
- `schedule_format`: structured_html, image, iframe_embed, pdf, social_only, none, unknown
- `scrape_status`: success, failed, no_schedule, no_open_mats, needs_review, pending

**Add to `open_mats` table:**

```sql
ALTER TABLE open_mats ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'community_submission';
ALTER TABLE open_mats ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE open_mats ADD COLUMN IF NOT EXISTS last_source_check timestamptz;
ALTER TABLE open_mats ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;
```

- `source_type`: website_scrape, image_ocr, social_media, community_submission, gym_owner

## Admin Dashboard: Extraction Tab

### Status Overview

Shows aggregate counts:
- **X gyms** with websites → **Y** scraped successfully → **Z** open mats extracted
- **Failed:** N gyms (with error details)
- **No schedule page:** N gyms
- **No open mats found:** N gyms (has schedule, but no open mat listed)
- **Needs review:** N gyms (bulk-extracted, awaiting admin check)

### Per-Gym View

Table with columns:
| Gym Name | Website | Platform | Schedule URL | Status | Open Mats Found | Last Scraped | Actions |
|----------|---------|----------|-------------|--------|-----------------|-------------|---------|
| Carlson Gracie GV | link | kicksite | /schedule/ | success | 1 | 2m ago | [Re-scrape] [View] |
| Gracie Barra Henderson | link | unknown | — | no_schedule | 0 | 2m ago | [Re-scrape] |

### Review Gate (for single-gym scrapes via API)

When admin clicks "Scrape" on a gym:
1. Spinner while pipeline runs
2. Results appear inline: "Found 2 open mats:"
   - Saturday 12:00-2:00 PM — Open Mat (Gi/NoGi)
   - Wednesday 7:00-8:30 PM — Open Roll (NoGi)
3. Admin clicks "Save to Database" or "Discard"

## Dependencies

**New npm packages needed:**

- `cheerio` — HTML parsing/querying (lightweight, no browser needed). Used by all parsers to traverse DOM.

**No other new dependencies.** We use native `fetch` for HTTP requests (available in Node 18+/Next.js).

## Scope Boundaries

### In scope
- Kicksite parser (Tier A)
- Generic HTML fallback parser (Tier A)
- Convention-based + link-crawl schedule URL discovery
- Bulk extraction script
- Single-gym API route with admin review gate
- Admin extraction dashboard tab
- Schema migration for source tracking + extraction metadata

### Explicitly out of scope (future work)
- Tier B: Image/OCR extraction (Claude Vision)
- Tier C: Social media monitoring
- Automated cron scheduling (run bulk manually for now)
- Screenshot archival (`source_snapshot_url`)
- Re-scrape frequency configuration per gym
- Headless browser rendering (Kicksite renders server-side, no JS needed)

## Success Criteria

1. Running `extract-all.ts` against 214 gyms produces extraction results for every gym with a website
2. At least some gyms yield real open mat data (Kicksite gyms like Carlson Gracie GV)
3. Admin can trigger single-gym extraction from the dashboard and review results before saving
4. Extracted open mats appear in search results with `source_type: 'website_scrape'` and appropriate confidence scores
5. The pipeline gracefully handles: timeouts, 404s, non-HTML responses, no schedule page, schedule page with no open mats, malformed HTML
