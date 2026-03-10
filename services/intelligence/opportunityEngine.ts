import type { Signal } from '@/apps/web/lib/types';

export function computeOpportunityScore(signals: Signal[]) {
  const score = signals.reduce((sum, signal) => sum + signal.significance_score, 0);
  if (score >= 3) return { label: 'HIGH', score };
  if (score >= 1.5) return { label: 'MEDIUM', score };
  return { label: 'LOW', score };
}
