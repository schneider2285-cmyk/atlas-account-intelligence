import { db } from '@/apps/web/lib/db';
import type { AgentRunResult } from '@/apps/web/lib/types';
import { scoreSignal } from '@/services/intelligence/scoring';
import { fetchYahooJobs } from '@/services/connectors/yahooWorkday';

export async function runYahooJobsAgent(): Promise<AgentRunResult> {
  const { data: accounts } = await db.from('accounts').select('id').eq('slug', 'yahoo').limit(1);
  const accountId = accounts?.[0]?.id;
  if (!accountId) throw new Error('Yahoo account not found');

  const jobs = await fetchYahooJobs();
  let inserted = 0;

  for (const job of jobs) {
    const { data: existing } = await db.from('job_postings').select('id').eq('external_job_id', job.external_job_id).limit(1);
    if (existing && existing.length > 0) continue;

    await db.from('job_postings').insert({
      account_id: accountId,
      external_job_id: job.external_job_id,
      title: job.title,
      location: job.location,
      url: job.url,
      detected_at: new Date().toISOString()
    });

    await db.from('signals').insert({
      account_id: accountId,
      signal_type: 'job_post',
      title: job.title,
      summary: `New Yahoo role detected, ${job.title}`,
      source_url: job.url,
      source_date: new Date().toISOString(),
      significance_score: scoreSignal('job_post')
    });

    inserted += 1;
  }

  return { agent: 'yahoo_jobs', account: 'yahoo', outputCount: inserted, status: 'success', summary: `Inserted ${inserted} Yahoo jobs.` };
}
