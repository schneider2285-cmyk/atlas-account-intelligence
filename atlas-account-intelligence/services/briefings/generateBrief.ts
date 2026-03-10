import { db } from '@/apps/web/lib/db';
import { computeOpportunityScore } from '@/services/intelligence/opportunityEngine';
import { recommendNextAction, summarizeSignals } from '@/services/intelligence/signalEngine';

export async function generateBriefForAccount(accountId: string) {
  const { data: signals, error } = await db
    .from('signals')
    .select('*')
    .eq('account_id', accountId)
    .order('detected_at', { ascending: false })
    .limit(25);

  if (error) throw error;

  const signalList = (signals ?? []) as any[];
  const summary = summarizeSignals(signalList as any);
  const opportunity = computeOpportunityScore(signalList as any);
  const nextAction = recommendNextAction(signalList as any);

  return {
    summary,
    opportunity,
    nextAction,
    signalCount: signalList.length
  };
}
