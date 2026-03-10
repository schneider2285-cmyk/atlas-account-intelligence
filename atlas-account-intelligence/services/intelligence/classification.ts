export function classifyDiscovery(seniorityLevel: string) {
  const seniority = seniorityLevel.toLowerCase();
  if (seniority.includes('svp') || seniority.includes('vp') || seniority.includes('director')) return 'outreach_priority';
  if (seniority.includes('manager') || seniority.includes('lead')) return 'add_to_targets';
  return 'knowledge_only';
}
