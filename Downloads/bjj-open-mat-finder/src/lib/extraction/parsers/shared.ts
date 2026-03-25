const OPEN_MAT_INCLUDE = [
  'open mat', 'open roll', 'free roll', 'open training', 'open gym',
];
const OPEN_MAT_EXCLUDE = [
  'open enrollment', 'open house', 'open door',
];

/**
 * Check if a class name matches open mat keywords.
 * Case-insensitive. Excludes false positives like "open enrollment".
 */
export function isOpenMatKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  if (OPEN_MAT_EXCLUDE.some((ex) => lower.includes(ex))) return false;
  return OPEN_MAT_INCLUDE.some((kw) => lower.includes(kw));
}

/**
 * Parse a time range string like "12:00 - 2:00 pm" into 24h format.
 * Returns { startTime, endTime } in "HH:MM" format.
 */
export function parseTimeRange(text: string): { startTime: string | null; endTime: string | null } {
  const match = text.match(
    /(\d{1,2}):(\d{2})\s*(am|pm)?\s*[-–]\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i
  );

  if (!match) return { startTime: null, endTime: null };

  const [, startH, startM, startAmpm, endH, endM, endAmpm] = match;

  const endPeriod = (endAmpm ?? startAmpm ?? '').toLowerCase();
  const startPeriod = (startAmpm ?? endAmpm ?? '').toLowerCase();

  const startTime = to24h(parseInt(startH), parseInt(startM), startPeriod);
  const endTime = to24h(parseInt(endH), parseInt(endM), endPeriod);

  return { startTime, endTime };
}

function to24h(hours: number, minutes: number, period: string): string {
  let h = hours;
  if (period === 'pm' && h < 12) h += 12;
  if (period === 'am' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
