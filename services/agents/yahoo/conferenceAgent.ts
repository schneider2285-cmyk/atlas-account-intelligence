import type { AgentRunResult } from '@/apps/web/lib/types';

export async function runYahooConferenceAgent(): Promise<AgentRunResult> {
  return {
    agent: 'yahoo_conference',
    account: 'yahoo',
    outputCount: 0,
    status: 'success',
    summary: 'Scaffolded conference agent. Wire real source logic next.'
  };
}
