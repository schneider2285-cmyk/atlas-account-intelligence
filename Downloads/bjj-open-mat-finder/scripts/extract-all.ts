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
        await supabase
          .from('open_mats')
          .delete()
          .eq('gym_id', gym.id)
          .eq('source_type', 'website_scrape');

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
