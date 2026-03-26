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
Layer 1: Google Places API  → Discover 3,000+ gyms nationwide
Layer 2: Website + AI       → Extract open mats from gym sites (~15% hit rate)
Layer 3: Google Search      → Find open mat mentions from social/reviews (~+15-20%)
Layer 4: Community          → Users verify/submit the rest (ongoing)
```

### Layer 1: Gym Discovery (Google Places Text Search)

**Approach:** Search Google Places Text Search across 50 US metros with 3 query variants:
- "brazilian jiu jitsu in {city}"
- "BJJ in {city}"
- "jiu jitsu in {city}"

**Details:**
- 50 metros x 3 queries = 150 API calls
- Text Search returns up to 60 results per query (3 pages of 20)
- Deduplicate by Google Place ID, then fuzzy match name+address against existing DB
- Capture: name, address, lat/lng, phone, website, Google Place ID, rating, review count
- US only (international is v2)
- Estimated cost: ~$15

**New files:**
- `scripts/discover-gyms.ts` — search, dedupe, insert to Supabase

### Layer 2: Website + AI Extraction (ALREADY BUILT)

**Current state:** Fully functional pipeline using Claude Haiku.
- Fetches gym website HTML
- Discovers schedule page via convention paths + link scanning
- Cleans HTML, sends to Haiku for structured extraction
- Validates and normalizes output
- 15% hit rate on current 277 gyms

**No changes needed.** Already committed and deployed.

### Layer 3: Google Search Fallback (Serper.dev + Haiku)

**Approach:** For gyms where Layer 2 found nothing, search Google for open mat references.

**How it works:**
1. Search Serper.dev for `"{gym name}" "open mat"` (8 results)
2. Feed result snippets to Claude Haiku for structured extraction
3. Save with `source_type: 'google_search'`, `confidence: 'low'`

**What this catches:**
- Instagram/Facebook posts mentioning open mat schedules
- Yelp/Google reviews mentioning open mat times
- BJJ directories (openmat.com, bjjglobetrotters.com)
- Reddit/forum posts

**Key design decisions:**
- Search snippets only — never visits Instagram/Facebook directly (ethical, no ToS issues)
- Snippets are ~200 tokens per gym, so Haiku calls cost ~$0.002/gym
- Source URL stored for user verification
- Estimated lift: 15% → 30-35% extraction rate

**Already coded:** `src/lib/extraction/google-search.ts` exists, needs Serper API key in `.env.local`.

**Required:** Sign up at serper.dev (free tier: 2,500 searches/month), add `SERPER_API_KEY` to `.env.local`.

### Layer 4: Community Submissions (ALREADY BUILT)

The `/submit` page allows users to add open mat data. No changes needed.

## Data Model & Confidence Tiers

### Confidence Display

| Tier | Source | UI Badge | Color |
|------|--------|----------|-------|
| Verified | Community submission | "Verified" | Green |
| High | Gym's own website | "Website" | Blue |
| Low | Google search snippets | "Unverified" | Gray |

### Database Fields (existing, need consistent usage)

- `source_type`: `'community'` | `'website_scrape'` | `'google_search'`
- `confidence_score`: `'high'` | `'medium'` | `'low'`
- `verified`: boolean (true only for community + confirmed)
- `source_url`: where data came from
- `needs_review`: boolean for admin queue

### UI Behavior

- All open mats display regardless of confidence tier
- Confidence badge shown next to each session
- Unverified results show "Help verify this" link → pre-filled submit flow
- Verified results show checkmark + "Verified by community"
- No data shown without attribution

## Build Sequence

1. **Gym Discovery Script** — `scripts/discover-gyms.ts`, search 50 metros, dedupe, insert
2. **Serper Integration** — add API key, already coded
3. **Run Full Extraction** — Layer 2 + Layer 3 on all gyms (~$25 for 3K gyms)
4. **Confidence Badges on UI** — update ResultCard with source badges + "Help verify" links
5. **Deploy** — Vercel push, verify production

## Cost Estimates

| Service | Cost |
|---------|------|
| Google Places API (discovery) | ~$15 one-time |
| Claude Haiku (extraction) | ~$21 per full run of 3K gyms |
| Serper.dev (Google search) | Free (2,500/mo) or $5/mo |
| Supabase | Free tier |
| **Total initial build-out** | **~$40** |
| **Monthly re-scraping** | **~$25/month** |

## What We're NOT Building

- Meta APIs (approval process too slow, Google search catches most social media mentions)
- Deep research agent with Playwright (v2, after traffic validates the product)
- Automated re-scraping cron (v2)
- International gym support (v2)

## Expected Outcome

- **3,000+ gyms** in database (up from 277)
- **900+ gyms with open mat data** (up from 39)
- **~30-35% extraction rate** (up from 14%)
- Clear verified vs unverified UX
- Community flywheel: more users → more verifications → better data → more users
