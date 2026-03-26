import { Suspense } from 'react';
import { geocode, haversineDistance } from '@/lib/geocoding';

// Force dynamic rendering — uses cookies() via Supabase server client.
export const dynamic = 'force-dynamic';
import { getTimeOfDayFilter } from '@/lib/utils';
import { getDemoGymsWithOpenMats } from '@/lib/demo-data';
import { discoverGyms } from '@/lib/google-places';
import type { Gym, MartialArtType, VisitorAccess, IntensityLevel, WomenPresence, BeginnerFriendly, CoachingPresence } from '@/lib/types';
import SearchBar from '@/components/search/SearchBar';
import FilterSidebar from '@/components/search/FilterSidebar';
import SearchResultsClient from '@/components/search/SearchResultsClient';

interface SearchParams {
  q?: string;
  lat?: string;
  lng?: string;
  radius?: string;
  day?: string;
  type?: string;
  free?: string;
  timeOfDay?: string;
  // North Star taxonomy filters
  visitorAccess?: string;
  intensity?: string;
  womenPresence?: string;
  beginnerFriendly?: string;
  coachingPresent?: string;
}

const MILES_TO_METERS = 1609.34;
const CACHE_DAYS = 7;

/**
 * Fetch gyms from Supabase, triggering Google Places discovery if:
 * - We have coordinates
 * - The area hasn't been discovered recently
 * - Google Places API key is configured
 *
 * Falls back to demo data if Supabase is unavailable.
 */
async function fetchGymsWithDiscovery(
  userLat?: number,
  userLng?: number,
  radiusMiles: number = 25
): Promise<Gym[]> {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return getDemoGymsWithOpenMats();
    }

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    // If we have coordinates and a Google API key, check if discovery is needed
    if (userLat !== undefined && userLng !== undefined && process.env.GOOGLE_PLACES_API_KEY) {
      const cacheKey = `${userLat.toFixed(2)},${userLng.toFixed(2)},${radiusMiles}`;
      const cutoffDate = new Date(Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const { data: recentDiscovery } = await supabase
        .from('discovery_log')
        .select('id')
        .eq('cache_key', cacheKey)
        .gte('discovered_at', cutoffDate)
        .limit(1);

      const needsDiscovery = !recentDiscovery || recentDiscovery.length === 0;

      if (needsDiscovery) {
        // Discover new gyms from Google Places
        const radiusMeters = radiusMiles * MILES_TO_METERS;
        const discovered = await discoverGyms(userLat, userLng, radiusMeters);

        if (discovered.length > 0) {
          // Batch upsert all discovered gyms in one call
          const gymRows = discovered.map((gym) => ({
            name: gym.name,
            address: gym.address,
            city: gym.city,
            state: gym.state,
            zip: gym.zip,
            lat: gym.lat,
            lng: gym.lng,
            phone: gym.phone,
            website: gym.website,
            google_place_id: gym.google_place_id,
            google_rating: gym.google_rating,
            google_user_ratings_total: gym.google_user_ratings_total,
            google_maps_url: gym.google_maps_url,
            general_visitor_policy: 'unknown',
            women_regularly_train: 'unknown',
            overall_vibe: [],
            claimed: false,
            discovery_source: 'google_places',
          }));

          await supabase.from('gyms').upsert(gymRows, {
            onConflict: 'google_place_id',
            ignoreDuplicates: false,
          });

          // Log this discovery
          await supabase.from('discovery_log').insert({
            cache_key: cacheKey,
            lat: userLat,
            lng: userLng,
            radius_miles: radiusMiles,
            gyms_found: discovered.length,
            discovered_at: new Date().toISOString(),
          });
        }
      }
    }

    // Fetch gyms from Supabase — use bounding box filter if we have coordinates
    let query = supabase
      .from('gyms')
      .select('*, open_mats(*)');

    if (userLat !== undefined && userLng !== undefined) {
      // Bounding box filter: ~1 degree lat ≈ 69 miles, 1 degree lng varies by latitude
      // Use generous padding (1.5x radius) to avoid missing edge cases
      const latDegPerMile = 1 / 69;
      const lngDegPerMile = 1 / (69 * Math.cos((userLat * Math.PI) / 180));
      const padMiles = radiusMiles * 1.5;
      const latPad = padMiles * latDegPerMile;
      const lngPad = padMiles * lngDegPerMile;

      query = query
        .gte('lat', userLat - latPad)
        .lte('lat', userLat + latPad)
        .gte('lng', userLng - lngPad)
        .lte('lng', userLng + lngPad);
    } else {
      // No coordinates — limit results to prevent loading entire DB
      query = query.limit(200);
    }

    const { data: gyms, error } = await query;

    if (!error && gyms && gyms.length > 0) {
      return gyms as Gym[];
    }
  } catch (err) {
    console.error('[search] Error fetching gyms:', err);
  }

  return getDemoGymsWithOpenMats();
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const {
    q,
    lat: latParam,
    lng: lngParam,
    radius: radiusParam,
    day,
    type,
    free,
    timeOfDay,
    visitorAccess,
    intensity,
    womenPresence,
    beginnerFriendly,
    coachingPresent,
  } = params;

  // Determine user location
  let userLat: number | undefined;
  let userLng: number | undefined;

  if (latParam && lngParam) {
    userLat = parseFloat(latParam);
    userLng = parseFloat(lngParam);
  } else if (q) {
    const geo = await geocode(q);
    if (geo) {
      userLat = geo.lat;
      userLng = geo.lng;
    }
  }

  const radiusMiles = radiusParam ? parseFloat(radiusParam) : 25;

  // Fetch gyms — triggers Google Places discovery if needed
  let gyms = await fetchGymsWithDiscovery(userLat, userLng, radiusMiles);

  // Calculate distances if we have a location
  let gymsWithDistance: (Gym & { distance?: number })[] = gyms.map((gym) => {
    if (userLat !== undefined && userLng !== undefined) {
      return {
        ...gym,
        distance: haversineDistance(userLat, userLng, gym.lat, gym.lng),
      };
    }
    return gym;
  });

  // Filter by radius — if geo filtering returns nothing, fall back to text match on query
  if (userLat !== undefined && userLng !== undefined) {
    const geoFiltered = gymsWithDistance.filter(
      (gym) => gym.distance !== undefined && gym.distance <= radiusMiles
    );
    if (geoFiltered.length > 0) {
      gymsWithDistance = geoFiltered;
    } else if (q) {
      // Fallback: match by city/state name
      const queryLower = q.toLowerCase();
      gymsWithDistance = gymsWithDistance.filter(
        (gym) =>
          gym.city.toLowerCase().includes(queryLower) ||
          gym.state.toLowerCase().includes(queryLower) ||
          gym.name.toLowerCase().includes(queryLower)
      );
    }
  } else if (q) {
    // No geolocation result — text search only
    const queryLower = q.toLowerCase();
    gymsWithDistance = gymsWithDistance.filter(
      (gym) =>
        gym.city.toLowerCase().includes(queryLower) ||
        gym.state.toLowerCase().includes(queryLower) ||
        gym.name.toLowerCase().includes(queryLower)
    );
  }

  // Filter by day of week
  if (day) {
    const days = day.split(',').map(Number);
    gymsWithDistance = gymsWithDistance.filter((gym) =>
      gym.open_mats?.some((om) => days.includes(om.day_of_week))
    );
  }

  // Filter by type
  if (type && (type === 'gi' || type === 'nogi' || type === 'both')) {
    const typeFilter = type as MartialArtType;
    gymsWithDistance = gymsWithDistance.filter((gym) =>
      gym.open_mats?.some(
        (om) => om.type === typeFilter || om.type === 'both' || typeFilter === 'both'
      )
    );
  }

  // Filter by free only
  if (free === '1') {
    gymsWithDistance = gymsWithDistance.filter((gym) =>
      gym.open_mats?.some((om) => om.price === 0)
    );
  }

  // Filter by time of day
  if (timeOfDay && timeOfDay !== 'any') {
    const { start, end } = getTimeOfDayFilter(timeOfDay);
    gymsWithDistance = gymsWithDistance.filter((gym) =>
      gym.open_mats?.some(
        (om) => om.start_time >= start && om.start_time < end
      )
    );
  }

  // Filter by visitor access (North Star Axis 2)
  if (visitorAccess) {
    const accessFilters = visitorAccess.split(',') as VisitorAccess[];
    gymsWithDistance = gymsWithDistance.filter((gym) =>
      gym.open_mats?.some((om) => accessFilters.includes(om.visitor_access))
    );
  }

  // Filter by intensity (North Star Axis 3)
  if (intensity) {
    const intensityFilters = intensity.split(',') as IntensityLevel[];
    gymsWithDistance = gymsWithDistance.filter((gym) =>
      gym.open_mats?.some((om) => intensityFilters.includes(om.intensity))
    );
  }

  // Filter by women's presence (North Star Section 4)
  // Toggle mode ("1") = women-friendly; CSV mode = specific values
  if (womenPresence) {
    if (womenPresence === '1') {
      gymsWithDistance = gymsWithDistance.filter((gym) =>
        gym.open_mats?.some((om) => om.women_presence === 'regularly_attend' || om.women_presence === 'women_specific')
      );
    } else {
      const wpFilters = womenPresence.split(',') as WomenPresence[];
      gymsWithDistance = gymsWithDistance.filter((gym) =>
        gym.open_mats?.some((om) => wpFilters.includes(om.women_presence))
      );
    }
  }

  // Filter by beginner friendly
  if (beginnerFriendly) {
    if (beginnerFriendly === '1') {
      gymsWithDistance = gymsWithDistance.filter((gym) =>
        gym.open_mats?.some((om) => om.beginner_friendly === 'yes' || om.beginner_friendly === 'somewhat')
      );
    } else {
      const bfFilters = beginnerFriendly.split(',') as BeginnerFriendly[];
      gymsWithDistance = gymsWithDistance.filter((gym) =>
        gym.open_mats?.some((om) => bfFilters.includes(om.beginner_friendly))
      );
    }
  }

  // Filter by coaching present
  if (coachingPresent) {
    if (coachingPresent === '1') {
      gymsWithDistance = gymsWithDistance.filter((gym) =>
        gym.open_mats?.some((om) => om.coaching_present === 'yes' || om.coaching_present === 'sometimes')
      );
    } else {
      const cpFilters = coachingPresent.split(',') as CoachingPresence[];
      gymsWithDistance = gymsWithDistance.filter((gym) =>
        gym.open_mats?.some((om) => cpFilters.includes(om.coaching_present))
      );
    }
  }

  // Sort: gyms WITH open mats first (by distance), then gyms without (by distance)
  const withOmCount = gymsWithDistance.filter(g => (g.open_mats?.length || 0) > 0).length;
  console.log(`[search] Sorting ${gymsWithDistance.length} gyms (${withOmCount} with open mats)`);
  gymsWithDistance.sort((a, b) => {
    const aHasOm = (a.open_mats?.length || 0) > 0 ? 0 : 1;
    const bHasOm = (b.open_mats?.length || 0) > 0 ? 0 : 1;
    if (aHasOm !== bHasOm) return aHasOm - bHasOm;
    if (a.distance !== undefined && b.distance !== undefined) {
      return a.distance - b.distance;
    }
    return a.name.localeCompare(b.name);
  });
  console.log(`[search] First 3 after sort: ${gymsWithDistance.slice(0, 3).map(g => g.name + '(' + (g.open_mats?.length||0) + ')').join(', ')}`);

  const locationLabel =
    q || (userLat && userLng ? `${userLat.toFixed(2)}, ${userLng.toFixed(2)}` : null);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <Suspense fallback={null}>
            <SearchBar />
          </Suspense>
          {locationLabel && (
            <p className="mt-2 text-sm text-gray-500">
              Showing results near <span className="font-medium text-gray-700">{locationLabel}</span>
              {userLat !== undefined && (
                <span> within {radiusMiles} miles</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filter sidebar */}
          <Suspense fallback={null}>
            <FilterSidebar />
          </Suspense>

          {/* Results */}
          <SearchResultsClient
            gyms={gymsWithDistance}
            totalCount={gymsWithDistance.length}
          />
        </div>
      </div>
    </div>
  );
}
