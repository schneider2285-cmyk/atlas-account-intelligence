import type { Signal } from '@/apps/web/lib/types';

export function summarizeSignals(signals: Signal[]) {
  const counts = signals.reduce<Record<string, number>>((acc, signal) => {
    acc[signal.signal_type] = (acc[signal.signal_type] || 0) + 1;
    return acc;
  }, {});

  return counts;
}

export function recommendNextAction(signals: Signal[]) {
  const jobPosts = signals.filter((signal) => signal.signal_type === 'job_post').length;
  const initiatives = signals.filter((signal) => signal.signal_type === 'initiative').length;

  if (initiatives > 0) return 'Review initiative acceleration and identify executive sponsor paths.';
  if (jobPosts > 0) return 'Review hiring expansion and map staffing angle to department leadership.';
  return 'Review recent signals and update manual outreach priorities.';
}
