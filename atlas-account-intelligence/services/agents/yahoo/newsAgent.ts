import { db } from '@/apps/web/lib/db';
import type { AgentRunResult } from '@/apps/web/lib/types';
import { fetchNewsSignals } from '@/services/connectors/newsService';

export async function runYahooNewsAgent(): Promise<AgentRunResult> {
  const { data: accounts } = await db.from('accounts').select('id').eq('slug', 'yahoo').limit(1);
  const accountId = accounts?.[0]?.id;
  if (!accountId) throw new Error('Yahoo account not found');

  const signals = await fetchNewsSignals('yahoo', accountId);
  if (signals.length > 0) {
    await db.from('signals').insert(signals);
  }

  return { agent: 'yahoo_news', account: 'yahoo', outputCount: signals.length, status: 'success', summary: `Inserted ${signals.length} Yahoo news signals.` };
}
