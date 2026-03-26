# Scale Open Mat Discovery Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scale from 277 gyms / 39 with open mat data to 3,000+ gyms / 900+ with open mat data.

**Architecture:** 4-layer funnel — Google Places discovery, website AI extraction (built), Google search fallback, community submissions (built). Each layer fills gaps left by previous layers.

**Tech Stack:** Next.js, Supabase, Claude Haiku API, Google Places API, Serper.dev API, TypeScript, vitest

**Spec:** `docs/superpowers/specs/2026-03-26-scale-open-mat-discovery-design.md`

---

## Chunk 1: Type System & Validation Updates

### Task 1: Add `google_search` to source_type unions

**Files:**
- Modify: `src/lib/types.ts:170`
- Modify: `src/lib/extraction/types.ts:96`

- [ ] **Step 1: Update OpenMat source_type union**

In `src/lib/types.ts` line 170, add `'google_search'`:

```typescript
source_type?: 'website_scrape' | 'image_ocr' | 'social_media' | 'google_search' | 'community_submission' | 'gym_owner' | null;
```

- [ ] **Step 2: Update ValidatedOpenMat source_type union**

In `src/lib/extraction/types.ts` line 96, add `'google_search'`:

```typescript
source_type: 'website_scrape' | 'image_ocr' | 'google_search';
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/extraction/types.ts
git commit -m "feat: add google_search to source_type unions"
```

---

### Task 2: Refactor validateAIExtraction to accept sourceType

**Files:**
- Modify: `src/lib/extraction/validate.ts:23-75`
- Test: `src/lib/extraction/__tests__/validate.test.ts`

- [ ] **Step 1: Write failing test for google_search source type**

Add to `src/lib/extraction/__tests__/validate.test.ts`:

```typescript
import { validateAIExtraction } from '../validate';
import type { AIExtractedOpenMat } from '../types';

describe('validateAIExtraction sourceType', () => {
  const baseOpenMat: AIExtractedOpenMat = {
    class_name: 'Open Mat',
    day_of_week: 6,
    start_time: '12:00',
    end_time: '14:00',
    type: 'both',
    recurring: true,
    women_only: false,
  };

  it('sets source_type to google_search when sourceType is google_search', () => {
    const result = validateAIExtraction(
      [baseOpenMat],
      'gym-123',
      'https://example.com',
      'google_search',
      null
    );
    expect(result[0].source_type).toBe('google_search');
    expect(result[0].confidence_score).toBe('low');
    expect(result[0].needs_review).toBe(true);
    expect(result[0].confirmation_method).toBe('social_media');
  });

  it('sets source_type to website_scrape when sourceType is website_scrape', () => {
    const result = validateAIExtraction(
      [baseOpenMat],
      'gym-123',
      'https://example.com',
      'website_scrape',
      null
    );
    expect(result[0].source_type).toBe('website_scrape');
    expect(result[0].confidence_score).toBe('medium');
    expect(result[0].needs_review).toBe(false);
    expect(result[0].confirmation_method).toBe('website_scrape');
  });

  it('sets source_type to image_ocr when sourceType is image_ocr', () => {
    const result = validateAIExtraction(
      [baseOpenMat],
      'gym-123',
      'https://example.com',
      'image_ocr',
      null
    );
    expect(result[0].source_type).toBe('image_ocr');
    expect(result[0].confidence_score).toBe('low');
    expect(result[0].needs_review).toBe(true);
    expect(result[0].confirmation_method).toBe('website_scrape');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/extraction/__tests__/validate.test.ts -v`
Expected: FAIL — function signature mismatch (4th param is boolean, not string)

- [ ] **Step 3: Refactor validateAIExtraction**

Change function signature from:
```typescript
export function validateAIExtraction(
  extracted: AIExtractedOpenMat[],
  gymId: string,
  sourceUrl: string,
  isScreenshot: boolean,
  confidenceNote: string | null
): ValidatedOpenMat[]
```

To:
```typescript
export function validateAIExtraction(
  extracted: AIExtractedOpenMat[],
  gymId: string,
  sourceUrl: string,
  sourceType: 'website_scrape' | 'image_ocr' | 'google_search',
  confidenceNote: string | null
): ValidatedOpenMat[]
```

Update the body — replace all `isScreenshot` references:
- `source_type: isScreenshot ? 'image_ocr' : 'website_scrape'` → `source_type: sourceType`
- `confidence_score: isScreenshot ? 'low' : 'medium'` → `confidence_score: sourceType === 'website_scrape' ? 'medium' : 'low'`
- `needs_review: isScreenshot` → `needs_review: sourceType !== 'website_scrape'`
- `confirmation_method: 'website_scrape'` → `confirmation_method: sourceType === 'google_search' ? 'social_media' : 'website_scrape'`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/extraction/__tests__/validate.test.ts -v`
Expected: PASS

- [ ] **Step 5: Update pipeline.ts callers**

In `src/lib/extraction/pipeline.ts`, update the two calls to `validateAIExtraction`:

Change line ~113:
```typescript
const validated = validateAIExtraction(
  aiResult.openMats,
  gymId,
  sourceUrl,
  isScreenshot,
  aiResult.confidenceNote,
);
```

To:
```typescript
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
```

Also add `let isGoogleSearch = false;` near `let isScreenshot = false;` and set it to `true` inside the `if (searchResult.openMats.length > 0)` block (pipeline.ts ~line 102).

Additionally, thread the search result URL as `sourceUrl` for Google search results. In the Google search fallback block, after setting `isGoogleSearch = true`, also update `sourceUrl`:

```typescript
if (searchResult.openMats.length > 0) {
  isGoogleSearch = true;
  // Use first search result URL as source instead of gym's schedule URL
  if (searchResult.sourceUrl) {
    sourceUrl = searchResult.sourceUrl;
  }
  // ... existing aiResult override ...
}
```

This requires updating `google-search.ts` to return `sourceUrl` (the best matching search result URL) in its return type. Add `sourceUrl?: string` to the return type of `searchAndExtractOpenMats()` and populate it with the first search result URL that contained "open mat".

- [ ] **Step 6: Run all tests**

Run: `npx vitest run -v`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/lib/extraction/validate.ts src/lib/extraction/__tests__/validate.test.ts src/lib/extraction/pipeline.ts
git commit -m "refactor: validate accepts sourceType instead of isScreenshot boolean"
```

---

## Chunk 2: Gym Discovery Script

### Task 3: Create discover-gyms.ts

**Files:**
- Create: `scripts/discover-gyms.ts`

- [ ] **Step 1: Create the script**

```typescript
/**
 * Discover BJJ gyms nationwide using Google Places Text Search.
 * Usage: npx tsx scripts/discover-gyms.ts [--limit N] [--dry-run]
 *
 * Searches 50 US metros with 3 query variants each.
 * Deduplicates by Google Place ID and fuzzy name+city match.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });
import { createServiceClient } from '../src/lib/supabase/service';

const QUERIES = [
  'brazilian jiu jitsu in',
  'BJJ in',
  'jiu jitsu in',
];

const METROS = [
  { name: 'New York', state: 'NY', lat: 40.7128, lng: -74.0060 },
  { name: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298 },
  { name: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698 },
  { name: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740 },
  { name: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652 },
  { name: 'San Antonio', state: 'TX', lat: 29.4241, lng: -98.4936 },
  { name: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611 },
  { name: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970 },
  { name: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431 },
  { name: 'Jacksonville', state: 'FL', lat: 30.3322, lng: -81.6557 },
  { name: 'San Jose', state: 'CA', lat: 37.3382, lng: -121.8863 },
  { name: 'Fort Worth', state: 'TX', lat: 32.7555, lng: -97.3308 },
  { name: 'Columbus', state: 'OH', lat: 39.9612, lng: -82.9988 },
  { name: 'Charlotte', state: 'NC', lat: 35.2271, lng: -80.8431 },
  { name: 'Indianapolis', state: 'IN', lat: 39.7684, lng: -86.1581 },
  { name: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194 },
  { name: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321 },
  { name: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903 },
  { name: 'Nashville', state: 'TN', lat: 36.1627, lng: -86.7816 },
  { name: 'Oklahoma City', state: 'OK', lat: 35.4676, lng: -97.5164 },
  { name: 'Washington', state: 'DC', lat: 38.9072, lng: -77.0369 },
  { name: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398 },
  { name: 'Portland', state: 'OR', lat: 45.5152, lng: -122.6784 },
  { name: 'Memphis', state: 'TN', lat: 35.1495, lng: -90.0490 },
  { name: 'Louisville', state: 'KY', lat: 38.2527, lng: -85.7585 },
  { name: 'Baltimore', state: 'MD', lat: 39.2904, lng: -76.6122 },
  { name: 'Milwaukee', state: 'WI', lat: 43.0389, lng: -87.9065 },
  { name: 'Albuquerque', state: 'NM', lat: 35.0844, lng: -106.6504 },
  { name: 'Tucson', state: 'AZ', lat: 32.2226, lng: -110.9747 },
  { name: 'Sacramento', state: 'CA', lat: 38.5816, lng: -121.4944 },
  { name: 'Kansas City', state: 'MO', lat: 39.0997, lng: -94.5786 },
  { name: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880 },
  { name: 'Omaha', state: 'NE', lat: 41.2565, lng: -95.9345 },
  { name: 'Colorado Springs', state: 'CO', lat: 38.8339, lng: -104.8214 },
  { name: 'Raleigh', state: 'NC', lat: 35.7796, lng: -78.6382 },
  { name: 'Virginia Beach', state: 'VA', lat: 36.8529, lng: -75.9780 },
  { name: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918 },
  { name: 'Oakland', state: 'CA', lat: 37.8044, lng: -122.2712 },
  { name: 'Minneapolis', state: 'MN', lat: 44.9778, lng: -93.2650 },
  { name: 'Tampa', state: 'FL', lat: 27.9506, lng: -82.4572 },
  { name: 'Tulsa', state: 'OK', lat: 36.1540, lng: -95.9928 },
  { name: 'New Orleans', state: 'LA', lat: 29.9511, lng: -90.0715 },
  { name: 'Cleveland', state: 'OH', lat: 41.4993, lng: -81.6944 },
  { name: 'Honolulu', state: 'HI', lat: 21.3069, lng: -157.8583 },
  { name: 'Pittsburgh', state: 'PA', lat: 40.4406, lng: -79.9959 },
  { name: 'St. Louis', state: 'MO', lat: 38.6270, lng: -90.1994 },
  { name: 'Cincinnati', state: 'OH', lat: 39.1031, lng: -84.5120 },
  { name: 'Orlando', state: 'FL', lat: 28.5383, lng: -81.3792 },
  { name: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589 },
];

interface PlaceResult {
  name: string;
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  place_id: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
}

async function searchPlaces(query: string, pageToken?: string): Promise<{
  results: PlaceResult[];
  nextPageToken?: string;
}> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY!;
  const params = new URLSearchParams({
    query,
    key: apiKey,
    type: 'gym',
  });
  if (pageToken) params.set('pagetoken', pageToken);

  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const data = await res.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.warn(`  Places API error: ${data.status} — ${data.error_message ?? ''}`);
    return { results: [] };
  }

  return {
    results: data.results ?? [],
    nextPageToken: data.next_page_token,
  };
}

function normalizeNameForDedup(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCity(address: string): string {
  // "123 Main St, Austin, TX 78701, USA" → "austin"
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 3) return parts[parts.length - 3].toLowerCase();
  if (parts.length >= 2) return parts[0].toLowerCase();
  return address.toLowerCase();
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limitIdx = process.argv.indexOf('--limit');
  const metroLimit = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : 0;

  const supabase = createServiceClient();

  // Load existing gyms for dedup
  console.log('Loading existing gyms for dedup...');
  const { data: existingGyms } = await supabase
    .from('gyms')
    .select('id, name, city, google_place_id');

  const existingPlaceIds = new Set(
    (existingGyms ?? [])
      .filter(g => g.google_place_id)
      .map(g => g.google_place_id)
  );

  const existingNameCity = new Set(
    (existingGyms ?? []).map(g =>
      `${normalizeNameForDedup(g.name)}|${(g.city ?? '').toLowerCase()}`
    )
  );

  console.log(`Existing gyms: ${existingGyms?.length ?? 0} (${existingPlaceIds.size} with Place IDs)`);

  const metros = metroLimit > 0 ? METROS.slice(0, metroLimit) : METROS;
  const allNewGyms: any[] = [];
  let duplicateCount = 0;
  let apiCalls = 0;

  for (let mi = 0; mi < metros.length; mi++) {
    const metro = metros[mi];
    console.log(`\n[${mi + 1}/${metros.length}] ${metro.name}, ${metro.state}`);

    for (const queryBase of QUERIES) {
      const query = `${queryBase} ${metro.name} ${metro.state}`;
      let pageToken: string | undefined;
      let page = 0;

      do {
        if (page > 0) {
          // Google requires ~2s delay before using nextPageToken
          await new Promise(r => setTimeout(r, 2500));
        }

        const { results, nextPageToken } = await searchPlaces(query, pageToken);
        apiCalls++;

        for (const place of results) {
          // Skip non-operational businesses
          if (place.business_status && place.business_status !== 'OPERATIONAL') continue;

          // Dedup by Place ID
          if (existingPlaceIds.has(place.place_id)) {
            duplicateCount++;
            continue;
          }

          // Dedup by name + city
          const city = extractCity(place.formatted_address);
          const nameKey = `${normalizeNameForDedup(place.name)}|${city}`;
          if (existingNameCity.has(nameKey)) {
            duplicateCount++;
            continue;
          }

          // Also check against gyms found in this run
          if (allNewGyms.some(g => g.google_place_id === place.place_id)) continue;
          if (allNewGyms.some(g =>
            normalizeNameForDedup(g.name) === normalizeNameForDedup(place.name) &&
            (g.city ?? '').toLowerCase() === city
          )) continue;

          // Parse address components
          const addressParts = place.formatted_address.split(',').map(p => p.trim());
          const stateZip = addressParts.length >= 2 ? addressParts[addressParts.length - 2] : '';
          const stateMatch = stateZip.match(/^([A-Z]{2})\s*(\d{5})?/);

          const newGym = {
            name: place.name,
            address: addressParts[0] ?? place.formatted_address,
            city: city.charAt(0).toUpperCase() + city.slice(1),
            state: stateMatch?.[1] ?? metro.state,
            zip: stateMatch?.[2] ?? null,
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
            website: place.website ?? null,
            google_place_id: place.place_id,
            google_rating: place.rating ?? null,
            google_user_ratings_total: place.user_ratings_total ?? null,
            discovery_source: 'google_places',
          };

          allNewGyms.push(newGym);
          existingPlaceIds.add(place.place_id);
          existingNameCity.add(nameKey);
        }

        pageToken = nextPageToken;
        page++;
      } while (pageToken && page < 3); // Max 3 pages (60 results) per query

      // Rate limit between queries
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`\n========== SUMMARY ==========`);
  console.log(`Metros searched:  ${metros.length}`);
  console.log(`API calls:        ${apiCalls}`);
  console.log(`New gyms found:   ${allNewGyms.length}`);
  console.log(`Duplicates:       ${duplicateCount}`);
  console.log(`With websites:    ${allNewGyms.filter(g => g.website).length}`);

  if (dryRun) {
    console.log('\n(Dry run — use without --dry-run to save to database)');
    // Show sample
    console.log('\nSample new gyms:');
    allNewGyms.slice(0, 10).forEach(g =>
      console.log(`  ${g.name} — ${g.city}, ${g.state} — ${g.website ?? 'no website'}`)
    );
    return;
  }

  // Insert in batches of 50
  console.log('\nInserting gyms to database...');
  let inserted = 0;
  for (let i = 0; i < allNewGyms.length; i += 50) {
    const batch = allNewGyms.slice(i, i + 50);
    const { error } = await supabase.from('gyms').insert(batch);
    if (error) {
      console.error(`  Batch ${i}-${i + batch.length} failed: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }
  console.log(`Inserted: ${inserted} gyms`);
}

main().catch(console.error);
```

- [ ] **Step 2: Test dry-run with 2 metros**

Run: `npx tsx scripts/discover-gyms.ts --limit 2 --dry-run`
Expected: Shows new gyms found in New York and Los Angeles, no DB writes

- [ ] **Step 3: Commit**

```bash
git add scripts/discover-gyms.ts
git commit -m "feat: add gym discovery script using Google Places Text Search"
```

---

### Task 4: Run gym discovery

- [ ] **Step 1: Run discovery across all 50 metros**

Run: `npx tsx scripts/discover-gyms.ts`
Expected: 2,000-3,000 new gyms inserted, summary printed

- [ ] **Step 2: Verify in database**

Run:
```bash
npx tsx -e "
import { config } from 'dotenv';
config({ path: '.env.local', override: true });
import { createServiceClient } from './src/lib/supabase/service';
const s = createServiceClient();
s.from('gyms').select('id', { count: 'exact', head: true }).then(r => {
  console.log('Total gyms:', r.count);
});
s.from('gyms').select('id', { count: 'exact', head: true }).not('website', 'is', null).then(r => {
  console.log('With websites:', r.count);
});
"
```

- [ ] **Step 3: Commit any script fixes**

---

## Chunk 3: Run Extraction Pipeline

### Task 5: Run Layer 2 + Layer 3 extraction on all gyms

- [ ] **Step 1: Add SERPER_API_KEY to .env.local**

User action: Sign up at serper.dev, get API key, then run:
```bash
echo 'SERPER_API_KEY=your-key-here' >> .env.local
```

- [ ] **Step 2: Dry-run extraction on 10 new gyms to verify**

Run: `npx tsx scripts/extract-all.ts --retry-failed --google-search --limit 10`
Expected: Shows extraction results, some with open mats from website, some from Google search

- [ ] **Step 3: Run full extraction with save**

Run: `npx tsx scripts/extract-all.ts --save --google-search`
Expected: Processes all gyms, saves open mats, prints summary with token usage and cost

- [ ] **Step 4: Check coverage**

Run:
```bash
npx tsx -e "
import { config } from 'dotenv';
config({ path: '.env.local', override: true });
import { createServiceClient } from './src/lib/supabase/service';
const s = createServiceClient();
s.from('gyms').select('id', { count: 'exact', head: true }).then(r => console.log('Total gyms:', r.count));
s.from('open_mats').select('gym_id').then(({ data }) => {
  const unique = new Set(data!.map(d => d.gym_id));
  console.log('Gyms with open mats:', unique.size);
});
s.from('open_mats').select('source_type').then(({ data }) => {
  const counts: Record<string, number> = {};
  data!.forEach(d => { counts[d.source_type ?? 'null'] = (counts[d.source_type ?? 'null'] || 0) + 1; });
  console.log('By source:', counts);
});
"
```

---

## Chunk 4: UI Confidence Badges

### Task 6: Add "Help verify this" link for unverified open mats

**Files:**
- Modify: `src/components/search/ResultCard.tsx`

- [ ] **Step 1: Add verify link to open mat schedule display**

In `ResultCard.tsx`, find the open mat schedule rendering block (the `.map()` over `openMats`). After the confidence dot + label, add a "Help verify" link for low/unverified confidence:

```tsx
{(om.confidence_score === 'low' || om.confidence_score === 'unverified') && (
  <a
    href={`/submit?gym_id=${gym.id}&gym_name=${encodeURIComponent(gym.name)}`}
    className="text-xs text-blue-500 hover:text-blue-700 underline ml-auto"
    onClick={(e) => e.stopPropagation()}
  >
    Help verify
  </a>
)}
```

- [ ] **Step 2: Add source badge next to confidence label**

After the confidence dot span, add a source type indicator:

```tsx
{om.source_type === 'google_search' && (
  <span className="text-xs text-gray-400 italic">via search</span>
)}
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/search/ResultCard.tsx
git commit -m "feat: add verify link and source badges on open mat listings"
```

---

### Task 7: Deploy to Vercel

- [ ] **Step 1: Push to remote**

Run: `git push`

- [ ] **Step 2: Verify deployment**

Check Vercel dashboard or run: `vercel --prod`

- [ ] **Step 3: Verify production shows data**

Navigate to production URL, search for a city, verify:
- Gym cards show open mat schedules
- Confidence dots/labels appear
- "Help verify" links show on unverified results
- "via search" shows on Google search sourced results

---

## Summary

| Task | What | Files | Est. Time |
|------|------|-------|-----------|
| 1 | Add google_search to types | types.ts, extraction/types.ts | 2 min |
| 2 | Refactor validateAIExtraction | validate.ts, pipeline.ts, test | 10 min |
| 3 | Create discover-gyms.ts | scripts/discover-gyms.ts | 15 min |
| 4 | Run gym discovery | (execution) | 10 min |
| 5 | Run extraction pipeline | (execution) | 45 min |
| 6 | UI confidence badges | ResultCard.tsx | 5 min |
| 7 | Deploy | (deployment) | 5 min |
| **Total** | | | **~90 min** |
