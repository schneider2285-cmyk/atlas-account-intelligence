import type { AgentRunResult } from '@/apps/web/lib/types';

export async function runYahooNetworkAgent(): Promise<AgentRunResult> {
  return {
    agent: 'yahoo_network',
    account: 'yahoo',
    outputCount: 0,
    status: 'success',
    summary: 'Scaffolded network agent. Wire real source logic next.'
  };
}
