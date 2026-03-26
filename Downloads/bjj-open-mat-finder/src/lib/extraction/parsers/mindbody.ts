import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { ScheduleParser, DetectionResult, ExtractedOpenMat } from '../types';
import { isOpenMatKeyword, parseTimeRange } from './shared';

const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, wed: 3,
  thu: 4, fri: 5, sat: 6,
};

/**
 * MindBody / HealCode parser — handles the Branded Web widget embeds
 * and MindBody schedule HTML.
 *
 * MindBody gyms embed schedules via HealCode widgets:
 *
 * 1. **HealCode widget embed** — a `<script>` tag or `<healcode-widget>` custom element
 *    that loads from `widgets.mindbodyonline.com` or `healcode.com`.
 *    The widget renders a schedule inside the page.
 *
 * 2. **Branded Web link** — gym links to `brandedweb.mindbodyonline.com` or
 *    `clients.mindbodyonline.com` which renders the full schedule.
 *
 * Widget embed pattern:
 *   <healcode-widget data-type="schedules" data-widget-partner="object"
 *     data-widget-id="..." data-widget-version="1" />
 *   <script src="https://widgets.mindbodyonline.com/javascripts/healcode.js"></script>
 *
 * Rendered schedule structure:
 *   .healcode-widget, .hc-widget
 *     .bw-widget, .bw-session
 *       .bw-session__date (day heading)
 *       .bw-session__time (time)
 *       .bw-session__name (class name)
 *   OR
 *   table.mb-schedule, .mindbody-schedule
 *     Column-per-day layout similar to Kicksite
 *
 * Telltale markers:
 *   - healcode.js script
 *   - healcode-widget custom element
 *   - mindbodyonline.com URLs
 *   - "Powered by Mindbody" / "Powered by MINDBODY"
 *   - data-widget-partner, data-widget-id attributes
 *   - bw-widget, bw-session CSS classes
 */
export const mindbodyParser: ScheduleParser = {
  name: 'mindbody',

  detect(html: string): DetectionResult {
    const signals: string[] = [];
    const lower = html.toLowerCase();

    // HealCode widget script tag
    if (lower.includes('healcode.js') || lower.includes('healcode')) {
      signals.push('healcode_script');
    }

    // HealCode custom element
    if (lower.includes('healcode-widget') || lower.includes('<healcode-widget')) {
      signals.push('healcode_widget_element');
    }

    // MindBody online URLs (various subdomains)
    if (lower.includes('mindbodyonline.com') || lower.includes('mindbody.io')) {
      signals.push('mindbody_url');
    }

    // Branded footer text
    if (lower.includes('powered by mindbody') || lower.includes('powered by mind body')) {
      signals.push('footer_branding');
    }

    // MindBody/HealCode widget data attributes
    if (html.includes('data-widget-partner') || html.includes('data-widget-id')) {
      signals.push('widget_data_attributes');
    }

    // Branded Web (bw-) CSS classes used by MindBody widgets
    if (html.includes('bw-widget') || html.includes('bw-session')) {
      signals.push('bw_css_classes');
    }

    // MindBody-specific schedule container classes
    if (html.includes('mb-schedule') || html.includes('mindbody-schedule')) {
      signals.push('mb_schedule_class');
    }

    // clients.mindbodyonline.com links
    if (lower.includes('clients.mindbodyonline.com')) {
      signals.push('clients_portal_url');
    }

    const detected = signals.length >= 2;
    const confidence = Math.min(1.0, signals.length * 0.25);

    return { detected, confidence, signals };
  },

  extract(html: string): ExtractedOpenMat[] {
    const $ = cheerio.load(html);
    const results: ExtractedOpenMat[] = [];

    // --- Strategy 1: Branded Web session blocks ---
    // MindBody's widget renders .bw-session blocks with date, time, and name children.
    extractFromBwSessions($, results);

    // --- Strategy 2: HealCode widget rendered schedule ---
    // Older HealCode widgets render inside .healcode-widget or .hc-widget containers
    // with table or list layouts.
    if (results.length === 0) {
      extractFromHealcodeWidget($, results);
    }

    // --- Strategy 3: MindBody table-based schedule ---
    // Some gyms render the MindBody schedule into a standard table
    // with day columns and time rows.
    if (results.length === 0) {
      extractFromMbTable($, results);
    }

    // --- Strategy 4: Generic day-grouped class listing ---
    // Fallback for MindBody pages that render a flat list of sessions
    // grouped under day headings.
    if (results.length === 0) {
      extractFromDayGroupedList($, results);
    }

    return results;
  },
};

/**
 * Extract from Branded Web (bw-) session blocks.
 *
 * Structure:
 *   .bw-session
 *     .bw-session__date "Monday, March 25"
 *     .bw-session__time "12:00 pm - 1:30 pm"
 *     .bw-session__name "Open Mat"
 */
function extractFromBwSessions($: cheerio.CheerioAPI, results: ExtractedOpenMat[]): void {
  // Track current day from date headers (sessions may be grouped under a date heading)
  let currentDay: number | undefined;

  // Process date headers that group sessions
  $('.bw-widget__day, .bw-session-group').each((_, group) => {
    const $group = $(group);
    const dateText = $group.find('.bw-session__date, .bw-widget__day-name').first().text().trim().toLowerCase();

    for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
      if (dateText.includes(dayName)) {
        currentDay = dayNum;
        break;
      }
    }

    // Process sessions within this group
    $group.find('.bw-session').each((_, session) => {
      processSession($, session, currentDay, results);
    });
  });

  // Also process standalone .bw-session elements (not inside a group)
  $('.bw-session').each((_, session) => {
    processSession($, session, undefined, results);
  });
}

function processSession(
  $: cheerio.CheerioAPI,
  session: AnyNode,
  inheritedDay: number | undefined,
  results: ExtractedOpenMat[],
): void {
  const $session = $(session);

  const nameEl = $session.find(
    '.bw-session__name, .bw-session__info-name, [class*="session__name"], [class*="className"]'
  );
  const className = nameEl.text().trim() || $session.find('.hc_class_name, .classname').text().trim();

  if (!className || !isOpenMatKeyword(className)) return;

  // Extract time
  const timeEl = $session.find(
    '.bw-session__time, .bw-session__info-time, [class*="session__time"], [class*="classTime"]'
  );
  const timeText = timeEl.text().trim() || $session.find('.hc_class_time, .classtime').text().trim();
  const { startTime, endTime } = parseTimeRange(timeText);
  if (!startTime) return;

  // Extract day
  let dayOfWeek = inheritedDay;

  if (dayOfWeek === undefined) {
    const dateEl = $session.find(
      '.bw-session__date, [class*="session__date"], [class*="classDate"]'
    );
    const dateText = dateEl.text().trim().toLowerCase();
    for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
      if (dateText.includes(dayName)) {
        dayOfWeek = dayNum;
        break;
      }
    }
  }

  // Try data attributes
  if (dayOfWeek === undefined) {
    const dayAttr = $session.attr('data-bw-widget-day') ?? $session.attr('data-day') ?? '';
    const parsed = parseInt(dayAttr, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 6) {
      dayOfWeek = parsed;
    }
  }

  if (dayOfWeek === undefined) return;

  const dayName = Object.entries(DAY_MAP).find(([, v]) => v === dayOfWeek)?.[0] ?? '';

  // Deduplicate: avoid adding the same entry twice
  const key = `${dayOfWeek}-${startTime}-${className}`;
  const isDuplicate = results.some(
    (r) => `${r.dayOfWeek}-${r.startTime}-${r.className}` === key
  );
  if (isDuplicate) return;

  results.push({
    className,
    dayOfWeek,
    startTime,
    endTime,
    rawText: `${dayName} ${timeText} - ${className}`,
  });
}

/**
 * Extract from HealCode widget containers with table layouts.
 */
function extractFromHealcodeWidget($: cheerio.CheerioAPI, results: ExtractedOpenMat[]): void {
  const widgetContainers = $('.healcode-widget, .hc-widget, [class*="healcode"], [data-hc-widget]');

  widgetContainers.each((_, container) => {
    const $container = $(container);

    // Try table layout inside the widget
    $container.find('table').each((_, table) => {
      extractFromScheduleTable($, $(table), results);
    });

    // Try list layout inside the widget
    $container.find('.hc_class, [class*="hc_class"]').each((_, classEntry) => {
      const $entry = $(classEntry);
      const className = $entry.find('.hc_class_name, .classname').text().trim();
      if (!className || !isOpenMatKeyword(className)) return;

      const timeText = $entry.find('.hc_class_time, .classtime').text().trim();
      const { startTime, endTime } = parseTimeRange(timeText);
      if (!startTime) return;

      const dateText = $entry.find('.hc_class_date, .classdate').text().trim().toLowerCase();
      let dayOfWeek: number | undefined;
      for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
        if (dateText.includes(dayName)) {
          dayOfWeek = dayNum;
          break;
        }
      }
      if (dayOfWeek === undefined) return;

      const dayName = Object.entries(DAY_MAP).find(([, v]) => v === dayOfWeek)?.[0] ?? '';
      results.push({
        className,
        dayOfWeek,
        startTime,
        endTime,
        rawText: `${dayName} ${timeText} - ${className}`,
      });
    });
  });
}

/**
 * Extract from a table with day-of-week column headers (MindBody table variant).
 */
function extractFromMbTable($: cheerio.CheerioAPI, results: ExtractedOpenMat[]): void {
  $('table.mb-schedule, table.mindbody-schedule, table.schedule, table').each((_, table) => {
    extractFromScheduleTable($, $(table), results);
  });
}

/**
 * Shared table extraction: day-of-week columns, time rows with class names.
 */
function extractFromScheduleTable(
  $: cheerio.CheerioAPI,
  $table: cheerio.Cheerio<AnyNode>,
  results: ExtractedOpenMat[],
): void {
  const dayColumns: (number | undefined)[] = [];

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

  const validDays = dayColumns.filter((d) => d !== undefined);
  if (validDays.length < 3) return;

  $table.find('tr').slice(1).each((_, row) => {
    const rowTimeText = $(row).find('td:first-child, th:first-child').text().trim();
    const rowTime = parseTimeRange(rowTimeText);

    $(row).find('td').each((colIdx, cell) => {
      const dayOfWeek = dayColumns[colIdx];
      if (dayOfWeek === undefined) return;

      const cellText = $(cell).text().trim();
      if (!cellText || !isOpenMatKeyword(cellText)) return;

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
}

/**
 * Extract from a flat day-grouped list (headings followed by class items).
 */
function extractFromDayGroupedList($: cheerio.CheerioAPI, results: ExtractedOpenMat[]): void {
  let currentDay: number | undefined;

  $('h1, h2, h3, h4, h5, h6, .day-header, .schedule-day-header, strong, b, dt').each((_, heading) => {
    const headingText = $(heading).text().trim().toLowerCase();

    for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
      if (headingText === dayName || headingText.startsWith(dayName)) {
        currentDay = dayNum;
        break;
      }
    }

    if (currentDay === undefined) return;

    let sibling = $(heading).next();
    if (sibling.length === 0) {
      sibling = $(heading).parent().next();
    }

    let count = 0;
    while (sibling.length > 0 && count < 30) {
      const sibText = sibling.text().trim();

      // Stop if we hit the next day heading
      const sibLower = sibText.toLowerCase();
      const isNextDay = Object.keys(DAY_MAP).some(
        (d) => sibLower === d || sibLower.startsWith(d + ' ')
      );
      if (isNextDay && sibling.is('h1, h2, h3, h4, h5, h6, .day-header, strong, b, dt')) {
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
}

/**
 * Strip time-range text from a class name string so we return a clean name.
 */
function stripTimeFromText(text: string): string {
  return text
    .replace(/\d{1,2}:\d{2}\s*(am|pm)?\s*[-–]?\s*\d{0,2}:?\d{0,2}\s*(am|pm)?/gi, '')
    .trim() || text;
}
