import type { AgentRunResult } from '@/apps/web/lib/types';

export async function runYahooSocialAgent(): Promise<AgentRunResult> {
  return {
    agent: 'yahoo_social',
    account: 'yahoo',
    outputCount: 0,
    status: 'success',
    summary: 'Scaffolded social agent. Wire real source logic next.'
  };
}
