/**
 * Extract open mats from a single gym's website using AI.
 * Usage: npx tsx scripts/extract-gym.ts <gym-id> [--save] [--screenshot]
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });
import { createServiceClient } from '../src/lib/supabase/service';
import { runExtractionPipeline } from '../src/lib/extraction/pipeline';

async function main() {
  const gymId = process.argv[2];
  if (!gymId || gymId.startsWith('--')) {
    console.error('Usage: npx tsx scripts/extract-gym.ts <gym-id> [--save] [--screenshot]');
    process.exit(1);
  }

  const shouldSave = process.argv.includes('--save');
  const enableScreenshot = process.argv.includes('--screenshot');
  const enableGoogleSearch = process.argv.includes('--google-search');

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
  console.log(`  Screenshot fallback: ${enableScreenshot ? 'enabled' : 'disabled'}`);

  const result = await runExtractionPipeline({
    gymId: gym.id,
    gymName: gym.name,
    websiteUrl: gym.website,
    needsReview: false,
    enableScreenshot,
    enableGoogleSearch,
  });

  // Update gym metadata
  await supabase.from('gyms').update({
    schedule_page_url: result.scheduleUrl ?? null,
    last_scraped_at: new Date().toISOString(),
    scrape_status: result.success
      ? (result.extractedCount > 0 ? 'success' : 'no_open_mats')
      : (result.error?.includes('No schedule') ? 'no_schedule' : 'failed'),
    scrape_error: result.error ?? null,
  }).eq('id', gym.id);

  console.log(`  Stage: ${result.stage}`);
  console.log(`  Schedule URL: ${result.scheduleUrl ?? 'none'}`);
  console.log(`  Extracted: ${result.extractedCount} open mats`);
  console.log(`  Validated: ${result.openMats.length} open mats`);

  if (result.tokensUsed) {
    console.log(`  Tokens: ${result.tokensUsed.input} in / ${result.tokensUsed.output} out`);
  }

  if (result.error) {
    console.log(`  Error: ${result.error}`);
  }

  if (result.openMats.length > 0) {
    console.log('\n  Open Mats Found:');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (const om of result.openMats) {
      const extras = [];
      if (om.visitor_access && om.visitor_access !== 'unknown') extras.push(om.visitor_access);
      if (om.drop_in_fee?.free) extras.push('free');
      else if (om.drop_in_fee?.amount) extras.push(`$${om.drop_in_fee.amount}`);
      if (om.coaching_present === 'yes') extras.push('coached');
      if (om.women_presence === 'women_specific') extras.push('women-only');

      console.log(
        `    ${days[om.day_of_week]} ${om.start_time}-${om.end_time} (${om.type}) [${om.confidence_score}]` +
        (extras.length ? ` — ${extras.join(', ')}` : '')
      );
      if (om.notes) console.log(`      Note: ${om.notes}`);
    }

    if (shouldSave) {
      // Delete existing scraped open mats for this gym
      await supabase.from('open_mats').delete()
        .eq('gym_id', gym.id)
        .in('source_type', ['website_scrape', 'image_ocr']);

      const { error: insertErr } = await supabase.from('open_mats').insert(result.openMats);
      if (insertErr) {
        console.log(`\n  Save error: ${insertErr.message}`);
      } else {
        console.log(`\n  ✓ Saved ${result.openMats.length} open mats to database.`);
      }
    } else {
      console.log('\n  (Dry run — use --save to persist to database)');
    }
  }
}

main().catch(console.error);
