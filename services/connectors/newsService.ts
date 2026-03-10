import type { Signal } from '@/apps/web/lib/types';

export async function fetchNewsSignals(accountSlug: string, accountId: string): Promise<Signal[]> {
  const now = new Date().toISOString();
  return [
    {
      account_id: accountId,
      signal_type: 'news',
      title: `${accountSlug} monitoring placeholder`,
      summary: `Wire real news connector for ${accountSlug}.`,
      source_url: null,
      source_date: now,
      significance_score: 0.4
    }
  ];
}
