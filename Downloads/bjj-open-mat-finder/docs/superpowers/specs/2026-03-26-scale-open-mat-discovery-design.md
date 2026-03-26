# Scale Open Mat Discovery: Design Spec

**Date:** 2026-03-26
**Status:** Approved
**Goal:** Scale from 277 gyms / 39 with open mat data to 3,000+ gyms / 900+ with open mat data

## Problem

The BJJ Open Mat Finder currently has 277 gyms, of which only 39 (14%) have open mat data. Most BJJ gyms DO have open mats, but many don't list them on their websites. The tool needs to:
1. Discover more gyms nationwide
2. Extract open mat data from more sources than just gym websites
3. Display both verified and unverified data with clear attribution

## Architecture: 4-Layer Funnel

Each layer runs independently, targeting gyms that previous layers missed.

```
Layer 1: Google Places API  -> Discover 3,000+ gyms nationwide
Layer 2: Website + AI       -> Extract open mats from gym sites (~15% hit rate)
Layer 3: Google Search      -> Find open mat mentions from social/reviews (~+15-20%)
Layer 4: Community          -> Users verify/submit the rest (ongoing)
```

### Layer 1: Gym Discovery (Google Places Text Search)

**Approach:** Search Google Places Text Search across 50 US metros with 3 query variants:
- "brazilian jiu jitsu in {city}"
- "BJJ in {city}"
- "jiu jitsu in {city}"

**Details:**
- 50 metros x 3 queries = 150 API calls, each paginated up to 3 pages (next_page_token)
- Text Search returns up to 60 results per query
- Must wait ~2 seconds between pagination requests (Google API requirement)
- Deduplicate by Google Place ID first (exact match), then fuzzy match name+address against existing DB (Levenshtein distance < 3 on normalized name, same city)
- Capture from Text Search response: name, formatted_address, lat/lng, website, place_id, rating, user_ratings_total, business_status
- Phone number requires Place Details call ($17/1K) -- skip for now, not essential
- US only (international is v2)
- Script is idempotent: re-running skips gyms already in DB by place_id match

**Metro list:** Top 50 US metros by population: New York, Los Angeles, Chicago, Houston, Phoenix, Philadelphia, San Antonio, San Diego, Dallas, Austin, Jacksonville, San Jose, Fort Worth, Columbus, Charlotte, Indianapolis, San Francisco, Seattle, Denver, Nashville, Oklahoma City, El Paso, Washington DC, Las Vegas, Portland, Memphis, Louisville, Baltimore, Milwaukee, Albuquerque, Tucson, Fresno, Sacramento, Mesa, Kansas City, Atlanta, Omaha, Colorado Springs, Raleigh, Long Beach, Virginia Beach, Miami, Oakland, Minneapolis, Tampa, Tulsa, Arlington, New Orleans, Wichita, Cleveland

**Estimated cost:** ~$15 (150 initial searches + ~300 pagination calls at $32/1K)

**New files:**
- `scripts/discover-gyms.ts` -- search, dedupe, insert to Supabase
- Includes metro coordinates list, pagination handling, dedup logic, error handling with retries

### Layer 2: Website + AI Extraction (ALREADY BUILT)

**Current state:** Fully functional pipeline using Claude Haiku.
- Fetches gym website HTML
- Discovers schedule page via convention paths + link scanning
- Cleans HTML, sends to Haiku for structured extraction
- Validates and normalizes output
- 15% hit rate on current 277 gyms
- Results saved with `source_type: 'website_scrape'`, `confidence_score: 'medium'`

**No changes needed.** Already committed and deployed.

### Layer 3: Google Search Fallback (Serper.dev + Haiku)

**Approach:** For gyms where Layer 2 found nothing, search Google for open mat references.

**How it works:**
1. Search Serper.dev for `"{gym name}" "open mat"` (8 results)
2. Feed result snippets to Claude Haiku for structured extraction
3. Save with `source_type: 'social_media'`, `confidence_score: 'low'`, `needs_review: true`

**What this catches:**
- Instagram/Facebook posts mentioning open mat schedules
- Yelp/Google reviews mentioning open mat times
- BJJ directories (openmat.com, bjjglobetrotters.com)
- Reddit/forum posts

**Key design decisions:**
- Search snippets only -- never visits Instagram/Facebook directly (ethical, no ToS issues)
- Snippets are ~200 tokens per gym, so Haiku calls cost ~$0.002/gym
- Source URL stored for user verification (first search result URL that mentions open mat)
- Estimated lift: 15% -> 30-35% extraction rate

**Required code changes:**
- Add `'google_search'` to `source_type` union in `src/lib/types.ts` (line 170)
- Update `validateAIExtraction` in `validate.ts` to accept a `sourceType` parameter instead of only `isScreenshot` boolean, so the pipeline can pass `'google_search'` for search results
- Update pipeline.ts to pass `sourceType: 'google_search'` and override `confidence_score: 'low'`, `needs_review: true` on validated results from the search path
- Thread the best matching search result URL through as `source_url` instead of the gym's schedule URL

**Required:** Sign up at serper.dev, add `SERPER_API_KEY` to `.env.local`. Free tier is 2,500/month; initial run of ~2,500 gyms fits but is tight. $5/month paid tier recommended.

### Layer 4: Community Submissions (ALREADY BUILT)

The `/submit` page allows users to add open mat data. No changes needed.
Results saved with `source_type: 'community_submission'`, `confidence_score: 'high'`.

## Data Model & Confidence Tiers

### Type System Changes Required

**`src/lib/types.ts` line 170 -- add `'google_search'` to source_type union:**
```typescript
source_type?: 'website_scrape' | 'image_ocr' | 'social_media' | 'google_search' | 'community_submission' | 'gym_owner' | null;
```

**`src/lib/extraction/types.ts` -- update `ValidatedOpenMat.source_type` to match:**
```typescript
source_type: 'website_scrape' | 'image_ocr' | 'google_search';
```

### Confidence Mapping (aligned with existing `ConfidenceLevel` type)

| Source | `source_type` | `confidence_score` | `needs_review` | `confirmation_method` |
|--------|--------------|-------------------|----------------|----------------------|
| Community submission | `'community_submission'` | `'high'` | `false` | `'community_report'` |
| Gym website scrape | `'website_scrape'` | `'medium'` | `false` | `'website_scrape'` |
| Google search snippets | `'google_search'` | `'low'` | `true` | `'social_media'` |
| Screenshot/OCR | `'image_ocr'` | `'low'` | `true` | `'website_scrape'` |

### UI Display (aligned with existing `CONFIDENCE_LABELS`)

The codebase already defines `CONFIDENCE_LABELS`:
- `high` -> "Verified"
- `medium` -> "Likely Accurate"
- `low` -> "Unconfirmed"
- `unverified` -> "Unverified"

**UI behavior:**
- All open mats display regardless of confidence tier
- Existing confidence dot + label system continues to work as-is
- Add "Help verify this" link on `low` and `unverified` results -> pre-filled submit flow with gym pre-selected and existing data shown
- `high` confidence results show green dot + "Verified"
- No data shown without attribution (source badge always visible)

### Existing `verified_count` field
The `OpenMat` type has `verified_count` (not a boolean `verified`). Community confirmations increment this counter. The UI should show "Verified" badge when `confidence_score === 'high'` OR `verified_count > 0`, not a separate boolean.

## Build Sequence

1. **Type system update** -- add `'google_search'` to `source_type` union in types.ts
2. **Validation update** -- refactor `validateAIExtraction` to accept `sourceType` parameter
3. **Pipeline update** -- pass correct source type for Google search path
4. **Gym Discovery Script** -- `scripts/discover-gyms.ts`, search 50 metros, dedupe, insert
5. **Run discovery** -- populate 3K gyms
6. **Run Full Extraction** -- Layer 2 + Layer 3 on all gyms
7. **Confidence Badges on UI** -- update ResultCard with "Help verify this" links for low-confidence data
8. **Deploy** -- Vercel push, verify production

## Cost Estimates

| Service | Cost |
|---------|------|
| Google Places API (discovery) | ~$15 one-time |
| Claude Haiku (extraction, 3K gyms) | ~$21 per full run |
| Serper.dev (Google search fallback) | Free tier or $5/mo |
| Supabase | Free tier |
| **Total initial build-out** | **~$40** |
| **Manual monthly re-run** | **~$25** (until cron is built in v2) |

## What We're NOT Building

- Meta APIs (approval process too slow, Google search catches most social media mentions via indexed posts)
- Deep research agent with Playwright (v2, after traffic validates the product)
- Automated re-scraping cron (v2, manual re-runs for now)
- International gym support (v2)

## Expected Outcome

- **3,000+ gyms** in database (up from 277)
- **900+ gyms with open mat data** (up from 39)
- **~30-35% extraction rate** (up from 14%)
- Clear confidence-tiered UX using existing CONFIDENCE_LABELS system
- Community flywheel: more users -> more verifications -> better data -> more users
