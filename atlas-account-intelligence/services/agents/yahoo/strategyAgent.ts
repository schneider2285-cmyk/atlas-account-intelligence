import type { AgentRunResult } from '@/apps/web/lib/types';

export async function runYahooStrategyAgent(): Promise<AgentRunResult> {
  return {
    agent: 'yahoo_strategy',
    account: 'yahoo',
    outputCount: 0,
    status: 'success',
    summary: 'Scaffolded strategy agent. Wire real source logic next.'
  };
}
