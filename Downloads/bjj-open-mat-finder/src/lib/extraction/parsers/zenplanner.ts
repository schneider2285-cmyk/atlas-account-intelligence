import * as cheerio from 'cheerio';
import type { ScheduleParser, DetectionResult, ExtractedOpenMat } from '../types';
import { isOpenMatKeyword, parseTimeRange } from './shared';

const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, wed: 3,
  thu: 4, fri: 5, sat: 6,
};

/**
 * Zen Planner parser — handles both embedded iframe references and
 * the actual Zen Planner portal schedule HTML.
 *
 * Zen Planner embeds follow two patterns:
 *
 * 1. **Iframe embed** — gym sites embed an iframe pointing to
 *    `*.zenplanner.com/zenplanner/portal/calendar.cfm`
 *    The iframe page renders a weekly calendar table.
 *
 * 2. **Direct portal HTML** — when we follow the iframe URL, we get the
 *    rendered schedule with this structure:
 *
 *      .calendar, .scheduleTable, #classSchedule
 *        table / thead with day-of-week headers
 *        tbody rows with time slots and class names
 *        .className, .classTime, .scheduleEntry, .calendarEntry
 *
 * Zen Planner pages also contain telltale markers:
 *   - URLs containing "zenplanner.com"
 *   - Meta/script references to zenplanner
 *   - CSS class prefixes like "zp-" or "zenplanner"
 *   - "Powered by Zen Planner" footer text
 */
export const zenPlannerParser: ScheduleParser = {
  name: 'zenplanner',

  detect(html: string): DetectionResult {
    const signals: string[] = [];
    const lower = html.toLowerCase();

    // Iframe or link to zenplanner.com portal
    if (lower.includes('zenplanner.com')) signals.push('zenplanner_url');

    // Branded footer text
    if (lower.includes('powered by zen planner') || lower.includes('powered by zenplanner')) {
      signals.push('footer_branding');
    }

    // Zen Planner specific CSS classes / IDs
    if (html.includes('zp-') || html.includes('zenplanner')) signals.push('zp_css_prefix');

    // Zen Planner calendar portal markers
    if (lower.includes('calendar.cfm') || lower.includes('classschedule.cfm')) {
      signals.push('portal_calendar_url');
    }

    // Zen Planner schedule-specific DOM classes
    if (html.includes('scheduleTable') || html.includes('classSchedule') || html.includes('schedule-table')) {
      signals.push('schedule_table_class');
    }

    // Zen Planner renders class entries with specific patterns
    if (html.includes('calendarEntry') || html.includes('scheduleEntry')) {
      signals.push('calendar_entry_class');
    }

    const detected = signals.length >= 2;
    const confidence = Math.min(1.0, signals.length * 0.25);

    return { detected, confidence, signals };
  },

  extract(html: string): ExtractedOpenMat[] {
    const $ = cheerio.load(html);
    const results: ExtractedOpenMat[] = [];

    // --- Strategy 1: Table-based schedule (most common Zen Planner layout) ---
    // Zen Planner renders a weekly grid table with day-of-week column headers
    // and time-based rows containing class entries.
    extractFromTables($, results);

    // --- Strategy 2: List/div-based schedule ---
    // Some Zen Planner configurations render day sections with class lists.
    if (results.length === 0) {
      extractFromDaySections($, results);
    }

    // --- Strategy 3: Calendar entry blocks ---
    // Zen Planner portal pages sometimes use .calendarEntry / .scheduleEntry
    // blocks that contain day, time, and class info as children.
    if (results.length === 0) {
      extractFromCalendarEntries($, results);
    }

    return results;
  },
};

/**
 * Extract from table-based schedule: columns are days, rows are time slots.
 */
function extractFromTables($: cheerio.CheerioAPI, results: ExtractedOpenMat[]): void {
  // Look for schedule tables — Zen Planner uses various class names
  const tables = $('table.scheduleTable, table.schedule-table, table#classSchedule, table.zp-schedule, table');

  tables.each((_, table) => {
    const $table = $(table);
    const dayColumns: (number | undefined)[] = [];

    // Read day-of-week headers from the first row (th or td in thead/first tr)
    const headerRow = $table.find('thead tr, tr').first();
    headerRow.find('th, td').each((colIdx, cell) => {
      const text = $(cell).text().trim().toLowerCase();
      for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
        if (text.includes(dayName)) {
          dayColumns[colIdx] = dayNum;
          break;
        }
      }
    });

    // Need at least 3 day columns to be a valid schedule table
    const validDays = dayColumns.filter((d) => d !== undefined);
    if (validDays.length < 3) return;

    // Scan each subsequent row for class entries
    $table.find('tr').slice(1).each((_, row) => {
      // Some Zen Planner layouts put the time in the first column (row header)
      const rowTimeText = $(row).find('td:first-child, th:first-child').text().trim();
      const rowTime = parseTimeRange(rowTimeText);

      $(row).find('td').each((colIdx, cell) => {
        const dayOfWeek = dayColumns[colIdx];
        if (dayOfWeek === undefined) return;

        const cellText = $(cell).text().trim();
        if (!cellText || !isOpenMatKeyword(cellText)) return;

        // Try to get time from the cell itself first, then fall back to row time
        let { startTime, endTime } = parseTimeRange(cellText);
        if (!startTime && rowTime.startTime) {
          startTime = rowTime.startTime;
          endTime = rowTime.endTime;
        }
        if (!startTime) return;

        const dayName = Object.entries(DAY_MAP).find(([, v]) => v === dayOfWeek)?.[0] ?? '';

        results.push({
          className: stripTimeFromText(cellText),
          dayOfWeek,
          startTime,
          endTime,
          rawText: `${dayName} ${cellText}`,
        });
      });
    });
  });
}

/**
 * Extract from day-section layout: headings per day with class lists underneath.
 */
function extractFromDaySections($: cheerio.CheerioAPI, results: ExtractedOpenMat[]): void {
  // Zen Planner sometimes renders day sections like:
  //   <div class="daySection"><h3>Monday</h3> ... <div class="classEntry">Open Mat 12:00-2:00pm</div>
  const daySectionSelectors = [
    '.daySection', '.day-section', '.zp-day',
    '.schedule-day', '[class*="daySchedule"]',
  ];

  let currentDay: number | undefined;

  // Also try scanning all headings for day names
  $('h1, h2, h3, h4, h5, h6, .day-header, .dayHeader, strong, b').each((_, heading) => {
    const headingText = $(heading).text().trim().toLowerCase();

    for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
      if (headingText === dayName || headingText.startsWith(dayName)) {
        currentDay = dayNum;
        break;
      }
    }

    if (currentDay === undefined) return;

    // Scan siblings after this heading until the next day heading
    let sibling = $(heading).next();
    // Also check parent's siblings for nested structures
    if (sibling.length === 0) {
      sibling = $(heading).parent().next();
    }

    const maxSiblings = 30;
    let count = 0;

    while (sibling.length > 0 && count < maxSiblings) {
      const sibText = sibling.text().trim();

      // Check if we hit the next day heading
      const sibLower = sibText.toLowerCase();
      const isNextDay = Object.keys(DAY_MAP).some(
        (d) => sibLower === d || sibLower.startsWith(d + ' ')
      );
      if (isNextDay && sibling.is('h1, h2, h3, h4, h5, h6, .day-header, .dayHeader, strong, b')) {
        break;
      }

      if (isOpenMatKeyword(sibText)) {
        const { startTime, endTime } = parseTimeRange(sibText);
        if (startTime) {
          const dayName = Object.entries(DAY_MAP).find(([, v]) => v === currentDay)?.[0] ?? '';
          results.push({
            className: stripTimeFromText(sibText),
            dayOfWeek: currentDay,
            startTime,
            endTime,
            rawText: `${dayName} ${sibText}`,
          });
        }
      }

      sibling = sibling.next();
      count++;
    }
  });

  // Also try explicit day section containers
  for (const selector of daySectionSelectors) {
    $(selector).each((_, section) => {
      const $section = $(section);
      const sectionText = $section.text().trim().toLowerCase();

      let dayOfWeek: number | undefined;
      for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
        if (sectionText.startsWith(dayName)) {
          dayOfWeek = dayNum;
          break;
        }
      }
      if (dayOfWeek === undefined) return;

      // Find class entries within this section
      $section.find('.classEntry, .class-entry, .zp-class, [class*="class"], div, span, li').each((_, entry) => {
        const entryText = $(entry).text().trim();
        if (!isOpenMatKeyword(entryText)) return;

        const { startTime, endTime } = parseTimeRange(entryText);
        if (!startTime) return;

        const dayName = Object.entries(DAY_MAP).find(([, v]) => v === dayOfWeek)?.[0] ?? '';
        results.push({
          className: stripTimeFromText(entryText),
          dayOfWeek,
          startTime,
          endTime,
          rawText: `${dayName} ${entryText}`,
        });
      });
    });
  }
}

/**
 * Extract from .calendarEntry / .scheduleEntry blocks.
 */
function extractFromCalendarEntries($: cheerio.CheerioAPI, results: ExtractedOpenMat[]): void {
  const entrySelectors = [
    '.calendarEntry', '.scheduleEntry', '.calendar-entry', '.schedule-entry',
    '.zp-entry', '[class*="calendarEntry"]', '[class*="scheduleEntry"]',
  ];

  const selector = entrySelectors.join(', ');
  $(selector).each((_, entry) => {
    const $entry = $(entry);
    const entryText = $entry.text().trim();

    if (!isOpenMatKeyword(entryText)) return;

    // Try to extract day from the entry or its parent context
    let dayOfWeek: number | undefined;

    // Check for data attributes first
    const dayAttr = $entry.attr('data-day') ?? $entry.attr('data-dayofweek') ?? '';
    if (dayAttr) {
      const dayNum = parseInt(dayAttr, 10);
      if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
        dayOfWeek = dayNum;
      }
    }

    // Fall back to scanning for day name in text
    if (dayOfWeek === undefined) {
      const lowerText = entryText.toLowerCase();
      for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
        if (lowerText.includes(dayName)) {
          dayOfWeek = dayNum;
          break;
        }
      }
    }

    // Fall back to parent/ancestor context
    if (dayOfWeek === undefined) {
      const parentText = $entry.closest('[class*="day"], [class*="Day"]').text().trim().toLowerCase();
      for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
        if (parentText.startsWith(dayName)) {
          dayOfWeek = dayNum;
          break;
        }
      }
    }

    if (dayOfWeek === undefined) return;

    const { startTime, endTime } = parseTimeRange(entryText);
    if (!startTime) return;

    const dayName = Object.entries(DAY_MAP).find(([, v]) => v === dayOfWeek)?.[0] ?? '';
    results.push({
      className: stripTimeFromText(entryText),
      dayOfWeek,
      startTime,
      endTime,
      rawText: `${dayName} ${entryText}`,
    });
  });
}

/**
 * Strip time-range text from a class name string so we return a clean name.
 */
function stripTimeFromText(text: string): string {
  return text
    .replace(/\d{1,2}:\d{2}\s*(am|pm)?\s*[-–]?\s*\d{0,2}:?\d{0,2}\s*(am|pm)?/gi, '')
    .trim() || text;
}
