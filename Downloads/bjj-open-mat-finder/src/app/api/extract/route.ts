import { type NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { runExtractionPipeline } from '@/lib/extraction/pipeline';

/**
 * POST /api/extract
 * Runs the extraction pipeline for a single gym.
 * Body: { gym_id: string }
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

  const result = await runExtractionPipeline({
    gymId: gym.id,
    gymName: gym.name,
    websiteUrl: gym.website,
    needsReview: false,
  });

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

  await supabase
    .from('open_mats')
    .delete()
    .eq('gym_id', gymId)
    .eq('source_type', 'website_scrape');

  const { error: insertError, count } = await supabase
    .from('open_mats')
    .insert(openMats);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await supabase.from('gyms').update({
    scrape_status: 'success',
    scrape_error: null,
  }).eq('id', gymId);

  return NextResponse.json({ saved: count ?? openMats.length });
}
