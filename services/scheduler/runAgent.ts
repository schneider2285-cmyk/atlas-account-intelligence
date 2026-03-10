import { runFicoIntelAgent } from '@/services/agents/fico/intelAgent';
import { runFicoStrategyAgent } from '@/services/agents/fico/strategyAgent';
import { runSchneiderIntelAgent } from '@/services/agents/schneider/intelAgent';
import { runSchneiderStrategyAgent } from '@/services/agents/schneider/strategyAgent';
import { runYahooConferenceAgent } from '@/services/agents/yahoo/conferenceAgent';
import { runYahooInitiativeAgent } from '@/services/agents/yahoo/initiativeAgent';
import { runYahooJobsAgent } from '@/services/agents/yahoo/jobsAgent';
import { runYahooNetworkAgent } from '@/services/agents/yahoo/networkAgent';
import { runYahooNewsAgent } from '@/services/agents/yahoo/newsAgent';
import { runYahooPeopleAgent } from '@/services/agents/yahoo/peopleAgent';
import { runYahooSocialAgent } from '@/services/agents/yahoo/socialAgent';
import { runYahooStrategyAgent } from '@/services/agents/yahoo/strategyAgent';

export async function runAgent(name: string) {
  switch (name) {
    case 'yahoo_jobs': return runYahooJobsAgent();
    case 'yahoo_news': return runYahooNewsAgent();
    case 'yahoo_people': return runYahooPeopleAgent();
    case 'yahoo_initiative': return runYahooInitiativeAgent();
    case 'yahoo_social': return runYahooSocialAgent();
    case 'yahoo_conference': return runYahooConferenceAgent();
    case 'yahoo_network': return runYahooNetworkAgent();
    case 'yahoo_strategy': return runYahooStrategyAgent();
    case 'fico_intel': return runFicoIntelAgent();
    case 'fico_strategy': return runFicoStrategyAgent();
    case 'schneider_intel': return runSchneiderIntelAgent();
    case 'schneider_strategy': return runSchneiderStrategyAgent();
    default: throw new Error(`Unknown agent: ${name}`);
  }
}

export const ALL_AGENT_NAMES = [
  'yahoo_jobs',
  'yahoo_news',
  'yahoo_people',
  'yahoo_initiative',
  'yahoo_social',
  'yahoo_conference',
  'yahoo_network',
  'yahoo_strategy',
  'fico_intel',
  'fico_strategy',
  'schneider_intel',
  'schneider_strategy'
] as const;
