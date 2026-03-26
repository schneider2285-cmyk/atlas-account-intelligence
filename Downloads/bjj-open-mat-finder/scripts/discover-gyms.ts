/**
 * Discover BJJ gyms nationwide using Google Places Text Search API.
 * Usage: npx tsx scripts/discover-gyms.ts [--dry-run] [--limit N]
 *
 * Searches 50 US metros with 3 query variants each, paginates up to 3 pages,
 * deduplicates by Google Place ID and normalized name+city, then inserts to Supabase.
 *
 * --dry-run: skip database inserts, just report what would be added
 * --limit N: only search the first N metros
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });
import { createServiceClient } from '../src/lib/supabase/service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// New Places API response types
interface PlaceResult {
  id: string; // place ID
  displayName: { text: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
}

interface TextSearchResponse {
  places?: PlaceResult[];
  nextPageToken?: string;
  error?: { message: string };
}

interface GymInsert {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  website: string | null;
  google_place_id: string;
  google_rating: number | null;
  google_user_ratings_total: number | null;
  discovery_source: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const METROS: { city: string; state: string }[] = [
  { city: 'New York', state: 'NY' },
  { city: 'Los Angeles', state: 'CA' },
  { city: 'Chicago', state: 'IL' },
  { city: 'Houston', state: 'TX' },
  { city: 'Phoenix', state: 'AZ' },
  { city: 'Philadelphia', state: 'PA' },
  { city: 'San Antonio', state: 'TX' },
  { city: 'San Diego', state: 'CA' },
  { city: 'Dallas', state: 'TX' },
  { city: 'Austin', state: 'TX' },
  { city: 'Jacksonville', state: 'FL' },
  { city: 'San Jose', state: 'CA' },
  { city: 'Fort Worth', state: 'TX' },
  { city: 'Columbus', state: 'OH' },
  { city: 'Charlotte', state: 'NC' },
  { city: 'Indianapolis', state: 'IN' },
  { city: 'San Francisco', state: 'CA' },
  { city: 'Seattle', state: 'WA' },
  { city: 'Denver', state: 'CO' },
  { city: 'Nashville', state: 'TN' },
  { city: 'Oklahoma City', state: 'OK' },
  { city: 'Washington', state: 'DC' },
  { city: 'Las Vegas', state: 'NV' },
  { city: 'Portland', state: 'OR' },
  { city: 'Memphis', state: 'TN' },
  { city: 'Louisville', state: 'KY' },
  { city: 'Baltimore', state: 'MD' },
  { city: 'Milwaukee', state: 'WI' },
  { city: 'Albuquerque', state: 'NM' },
  { city: 'Tucson', state: 'AZ' },
  { city: 'Sacramento', state: 'CA' },
  { city: 'Kansas City', state: 'MO' },
  { city: 'Atlanta', state: 'GA' },
  { city: 'Omaha', state: 'NE' },
  { city: 'Colorado Springs', state: 'CO' },
  { city: 'Raleigh', state: 'NC' },
  { city: 'Virginia Beach', state: 'VA' },
  { city: 'Miami', state: 'FL' },
  { city: 'Oakland', state: 'CA' },
  { city: 'Minneapolis', state: 'MN' },
  { city: 'Tampa', state: 'FL' },
  { city: 'Tulsa', state: 'OK' },
  { city: 'New Orleans', state: 'LA' },
  { city: 'Cleveland', state: 'OH' },
  { city: 'Honolulu', state: 'HI' },
  { city: 'Pittsburgh', state: 'PA' },
  { city: 'St. Louis', state: 'MO' },
  { city: 'Cincinnati', state: 'OH' },
  { city: 'Orlando', state: 'FL' },
  { city: 'Boston', state: 'MA' },
];

const QUERY_TEMPLATES = [
  'brazilian jiu jitsu in {city}',
  'BJJ in {city}',
  'jiu jitsu in {city}',
];

const MAX_PAGES = 3;
const PAGE_TOKEN_DELAY_MS = 2500;
const BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(name: string, city: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}|${city.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

function parseAddress(formatted: string): { address: string; city: string; state: string; zip: string } {
  // Typical Google format: "123 Main St, Austin, TX 78701, USA"
  const parts = formatted.split(',').map((s) => s.trim());

  // Default fallbacks
  let address = parts[0] || '';
  let city = '';
  let state = '';
  let zip = '';

  // City is typically 2nd-to-last part (before "STATE ZIP, USA" or "STATE ZIP")
  if (parts.length >= 3) {
    city = parts[parts.length - 3] || parts[0];
  } else if (parts.length === 2) {
    city = parts[0];
  }

  // State + zip from last US-relevant part
  // Look for pattern like "TX 78701" or "DC 20001"
  const stateZipPart = parts.length >= 2 ? parts[parts.length - 2] : '';
  const stateZipMatch = stateZipPart.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (stateZipMatch) {
    state = stateZipMatch[1];
    zip = stateZipMatch[2];
  } else {
    // Try just state
    const stateOnly = stateZipPart.match(/^([A-Z]{2})$/);
    if (stateOnly) {
      state = stateOnly[1];
    }
  }

  // Full address is everything before city
  if (parts.length >= 4) {
    address = parts.slice(0, parts.length - 3).join(', ');
  }

  return { address, city, state, zip };
}

async function searchPlaces(query: string, apiKey: string, pageToken?: string): Promise<TextSearchResponse> {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  const body: Record<string, unknown> = {
    textQuery: query,
    maxResultCount: 20,
  };
  if (pageToken) {
    body.pageToken = pageToken;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,nextPageToken',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Places API error: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<TextSearchResponse>;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limitIdx = process.argv.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : 0;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_PLACES_API_KEY is not set in .env.local');
    process.exit(1);
  }

  const supabase = createServiceClient();

  // -----------------------------------------------------------------------
  // Load existing gyms for dedup
  // -----------------------------------------------------------------------
  console.log('Loading existing gyms for deduplication...');
  const { data: existingGyms, error: fetchErr } = await supabase
    .from('gyms')
    .select('id, name, city, google_place_id');

  if (fetchErr) {
    console.error('Failed to fetch existing gyms:', fetchErr.message);
    process.exit(1);
  }

  const existingPlaceIds = new Set<string>();
  const existingNameCity = new Set<string>();

  for (const g of existingGyms || []) {
    if (g.google_place_id) existingPlaceIds.add(g.google_place_id);
    if (g.name && g.city) existingNameCity.add(normalize(g.name, g.city));
  }

  console.log(`  ${existingPlaceIds.size} existing place IDs, ${existingNameCity.size} existing name|city combos\n`);

  // -----------------------------------------------------------------------
  // Discover gyms across metros
  // -----------------------------------------------------------------------
  const metros = limit > 0 ? METROS.slice(0, limit) : METROS;

  console.log(`Searching ${metros.length} metros${dryRun ? ' (DRY RUN)' : ''}`);
  console.log('');

  const stats = {
    metrosSearched: 0,
    apiCalls: 0,
    totalResults: 0,
    duplicatesPlaceId: 0,
    duplicatesNameCity: 0,
    newGyms: 0,
    gymsWithWebsites: 0,
    insertErrors: 0,
  };

  // Track place IDs and name|city found in this run for intra-run dedup
  const runPlaceIds = new Set<string>();
  const runNameCity = new Set<string>();

  const pendingInserts: GymInsert[] = [];

  for (const metro of metros) {
    const label = `${metro.city}, ${metro.state}`;
    process.stdout.write(`[${stats.metrosSearched + 1}/${metros.length}] ${label}... `);

    let metroNew = 0;

    for (const template of QUERY_TEMPLATES) {
      const query = template.replace('{city}', `${metro.city} ${metro.state}`);
      let pageToken: string | undefined;

      for (let page = 0; page < MAX_PAGES; page++) {
        let response: TextSearchResponse;
        try {
          response = await searchPlaces(query, apiKey, pageToken);
          stats.apiCalls++;
        } catch (err) {
          console.error(`\n  API error: ${(err as Error).message}`);
          break;
        }

        if (response.error) {
          console.error(`\n  API error: ${response.error.message} for query "${query}"`);
          break;
        }

        const places = response.places ?? [];
        for (const place of places) {
          stats.totalResults++;

          // Skip non-operational businesses
          if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') {
            continue;
          }

          // Dedup by place_id (exact)
          if (existingPlaceIds.has(place.id) || runPlaceIds.has(place.id)) {
            stats.duplicatesPlaceId++;
            continue;
          }

          // Parse address
          const parsed = parseAddress(place.formattedAddress);

          // Dedup by normalized name|city (fuzzy)
          const key = normalize(place.displayName.text, parsed.city);
          if (existingNameCity.has(key) || runNameCity.has(key)) {
            stats.duplicatesNameCity++;
            continue;
          }

          // Mark as seen for this run
          runPlaceIds.add(place.id);
          runNameCity.add(key);

          const gym: GymInsert = {
            name: place.displayName.text,
            address: parsed.address,
            city: parsed.city,
            state: parsed.state,
            zip: parsed.zip,
            lat: place.location.latitude,
            lng: place.location.longitude,
            website: place.websiteUri || null,
            google_place_id: place.id,
            google_rating: place.rating ?? null,
            google_user_ratings_total: place.userRatingCount ?? null,
            discovery_source: 'google_places',
          };

          pendingInserts.push(gym);
          metroNew++;
          stats.newGyms++;
          if (gym.website) stats.gymsWithWebsites++;
        }

        // Check for next page
        pageToken = response.nextPageToken;
        if (!pageToken) break;

        // Google requires a delay before next_page_token is valid
        await delay(PAGE_TOKEN_DELAY_MS);
      }
    }

    console.log(`${metroNew} new gyms`);
    stats.metrosSearched++;

    // Batch insert when we have enough
    if (!dryRun && pendingInserts.length >= BATCH_SIZE) {
      const batch = pendingInserts.splice(0, BATCH_SIZE);
      const { error: insertErr } = await supabase.from('gyms').insert(batch);
      if (insertErr) {
        console.error(`  Insert error: ${insertErr.message}`);
        stats.insertErrors++;
      }
    }
  }

  // Insert remaining
  if (!dryRun && pendingInserts.length > 0) {
    // Insert in batches of BATCH_SIZE
    while (pendingInserts.length > 0) {
      const batch = pendingInserts.splice(0, BATCH_SIZE);
      const { error: insertErr } = await supabase.from('gyms').insert(batch);
      if (insertErr) {
        console.error(`  Insert error: ${insertErr.message}`);
        stats.insertErrors++;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log('\n========== SUMMARY ==========');
  console.log(`Metros searched:     ${stats.metrosSearched}`);
  console.log(`API calls:           ${stats.apiCalls}`);
  console.log(`Total results:       ${stats.totalResults}`);
  console.log(`Dup (place ID):      ${stats.duplicatesPlaceId}`);
  console.log(`Dup (name|city):     ${stats.duplicatesNameCity}`);
  console.log(`New gyms found:      ${stats.newGyms}`);
  console.log(`Gyms with websites:  ${stats.gymsWithWebsites}`);
  if (stats.insertErrors > 0) {
    console.log(`Insert errors:       ${stats.insertErrors}`);
  }
  if (dryRun) {
    console.log(`\n(DRY RUN — no database writes performed)`);
  }
}

main().catch(console.error);
