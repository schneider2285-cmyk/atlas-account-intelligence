import type { AgentRunResult } from '@/apps/web/lib/types';

export async function runYahooPeopleAgent(): Promise<AgentRunResult> {
  return {
    agent: 'yahoo_people',
    account: 'yahoo',
    outputCount: 0,
    status: 'success',
    summary: 'Scaffolded people agent. Wire real source logic next.'
  };
}
