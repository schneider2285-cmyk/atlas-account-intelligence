/**
 * Run AI extraction pipeline for ALL gyms with websites.
 * Usage: npx tsx scripts/extract-all.ts [--save] [--screenshot] [--google-search] [--limit N] [--retry-failed]
 *
 * Without --save: dry run, shows what would be extracted
 * With --save: saves extracted open mats to database with needs_review=true
 * With --screenshot: enable Playwright screenshot fallback for JS-rendered pages
 * With --google-search: enable Google search fallback for gyms with no website open mat data
 * With --limit N: only process first N gyms
 * With --retry-failed: only process gyms that previously failed or had no open mats
 * With --unscraped: only process gyms that haven't been scraped yet
 * With --offset N: skip first N gyms (for pagination)
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });
import { createServiceClient } from '../src/lib/supabase/service';
import { runExtractionPipeline } from '../src/lib/extraction/pipeline';
import { launchBrowser, closeBrowser } from '../src/lib/extraction/screenshot';

async function main() {
  const shouldSave = process.argv.includes('--save');
  const enableScreenshot = process.argv.includes('--screenshot');
  const enableGoogleSearch = process.argv.includes('--google-search');
  const retryFailed = process.argv.includes('--retry-failed');
  const unscrapedOnly = process.argv.includes('--unscraped');
  const limitIdx = process.argv.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : 0;
  const offsetIdx = process.argv.indexOf('--offset');
  const offset = offsetIdx !== -1 ? parseInt(process.argv[offsetIdx + 1]) : 0;

  const supabase = createServiceClient();

  let query = supabase
    .from('gyms')
    .select('id, name, website')
    .not('website', 'is', null)
    .order('name');

  if (unscrapedOnly) {
    // Only process gyms that haven't been scraped yet
    query = query.is('scrape_status', null);
  } else if (retryFailed) {
    // Only re-process gyms that had no open mats or failed
    query = query.in('scrape_status', ['no_open_mats', 'failed', 'no_schedule']);
  }

  if (offset > 0) {
    query = query.range(offset, offset + (limit > 0 ? limit - 1 : 4999));
  } else if (limit > 0) {
    query = query.limit(limit);
  } else {
    // Supabase defaults to 1000 rows — override to get all gyms
    query = query.limit(5000);
  }

  const { data: gyms, error } = await query;

  if (error || !gyms) {
    console.error('Failed to fetch gyms:', error?.message);
    process.exit(1);
  }

  console.log(`Found ${gyms.length} gyms with websites`);
  console.log(`Mode: ${shouldSave ? 'SAVE' : 'DRY RUN'}`);
  console.log(`Screenshot fallback: ${enableScreenshot ? 'ON' : 'OFF'}`);
  console.log(`Google search fallback: ${enableGoogleSearch ? 'ON' : 'OFF'}`);
  if (retryFailed) console.log('Retry mode: only processing previously failed gyms');
  if (unscrapedOnly) console.log('Unscraped only: skipping already-processed gyms');
  if (offset > 0) console.log(`Offset: starting at gym ${offset}`);
  console.log('');

  // Launch shared browser if screenshots enabled
  if (enableScreenshot) {
    console.log('Launching browser for screenshots...');
    await launchBrowser();
  }

  const stats = {
    total: gyms.length,
    success: 0,
    noSchedule: 0,
    noOpenMats: 0,
    failed: 0,
    totalOpenMats: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
  };

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 0; i < gyms.length; i++) {
    const gym = gyms[i];
    if (!gym.website) continue;

    process.stdout.write(`[${i + 1}/${gyms.length}] ${gym.name}... `);

    try {
      const result = await runExtractionPipeline({
        gymId: gym.id,
        gymName: gym.name,
        websiteUrl: gym.website,
        needsReview: true,
        enableScreenshot,
        enableGoogleSearch,
      });

      // Track token usage
      if (result.tokensUsed) {
        stats.totalInputTokens += result.tokensUsed.input;
        stats.totalOutputTokens += result.tokensUsed.output;
      }

      // Update gym metadata
      await supabase.from('gyms').update({
        schedule_page_url: result.scheduleUrl ?? null,
        last_scraped_at: new Date().toISOString(),
        scrape_status: result.success
          ? (result.extractedCount > 0 ? 'success' : 'no_open_mats')
          : (result.error?.includes('No schedule') ? 'no_schedule' : 'failed'),
        scrape_error: result.error ?? null,
      }).eq('id', gym.id);

      if (result.openMats.length > 0) {
        stats.success++;
        stats.totalOpenMats += result.openMats.length;
        const tokens = result.tokensUsed
          ? ` [${result.tokensUsed.input + result.tokensUsed.output} tokens]`
          : '';
        console.log(`✓ ${result.openMats.length} open mats${tokens}`);

        for (const om of result.openMats) {
          console.log(`    ${days[om.day_of_week]} ${om.start_time}-${om.end_time} (${om.type})`);
        }

        if (shouldSave) {
          // Delete existing scraped open mats for this gym
          await supabase.from('open_mats').delete()
            .eq('gym_id', gym.id)
            .in('source_type', ['website_scrape', 'image_ocr']);

          const { error: insertErr } = await supabase
            .from('open_mats')
            .insert(result.openMats);

          if (insertErr) {
            console.log(`    ⚠ Save failed: ${insertErr.message}`);
          }
        }
      } else if (result.error?.includes('No schedule') || result.error?.includes('Failed to fetch')) {
        stats.noSchedule++;
        console.log('— no schedule page');
      } else if (result.success && result.extractedCount === 0) {
        stats.noOpenMats++;
        console.log('— schedule found, no open mats');
      } else {
        stats.failed++;
        console.log(`✗ ${result.error}`);
      }
    } catch (err) {
      stats.failed++;
      console.log(`✗ ${(err as Error).message}`);
    }

    // Rate limit: 500ms between gyms (respect both website + API rate limits)
    await new Promise((r) => setTimeout(r, 500));
  }

  // Close browser if we launched one
  if (enableScreenshot) {
    await closeBrowser();
  }

  // Cost estimate (Haiku pricing: $1/M input, $5/M output)
  const inputCost = (stats.totalInputTokens / 1_000_000) * 1;
  const outputCost = (stats.totalOutputTokens / 1_000_000) * 5;
  const totalCost = inputCost + outputCost;

  console.log('\n========== SUMMARY ==========');
  console.log(`Total gyms:       ${stats.total}`);
  console.log(`Open mats found:  ${stats.success} gyms, ${stats.totalOpenMats} total sessions`);
  console.log(`No schedule page: ${stats.noSchedule}`);
  console.log(`No open mats:     ${stats.noOpenMats}`);
  console.log(`Failed:           ${stats.failed}`);
  console.log(`\nToken usage:      ${stats.totalInputTokens.toLocaleString()} in / ${stats.totalOutputTokens.toLocaleString()} out`);
  console.log(`Estimated cost:   $${totalCost.toFixed(4)} (input: $${inputCost.toFixed(4)}, output: $${outputCost.toFixed(4)})`);

  if (stats.total > 0) {
    const costPer3000 = (totalCost / stats.total) * 3000;
    console.log(`Projected 3K gyms: ~$${costPer3000.toFixed(2)}`);
  }
}

main().catch(console.error);
