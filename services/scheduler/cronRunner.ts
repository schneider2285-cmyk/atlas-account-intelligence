import { ALL_AGENT_NAMES, runAgent } from '@/services/scheduler/runAgent';

export async function runDailyCycle() {
  const results = [];
  for (const agentName of ALL_AGENT_NAMES) {
    try {
      const result = await runAgent(agentName);
      results.push(result);
    } catch (error) {
      results.push({ agent: agentName, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
  return results;
}
