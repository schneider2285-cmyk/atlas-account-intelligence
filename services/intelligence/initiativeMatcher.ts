export function matchInitiative(text: string) {
  const normalized = text.toLowerCase();
  if (normalized.includes('mail')) return 'Yahoo Mail Modernization';
  if (normalized.includes('titan')) return 'TITAN';
  if (normalized.includes('platform')) return 'FICO Platform';
  return null;
}
