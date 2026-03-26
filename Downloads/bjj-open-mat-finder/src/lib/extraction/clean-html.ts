import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

const SCHEDULE_KEYWORDS = [
  'schedule', 'open mat', 'class', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday', 'sunday', 'rolling', 'training',
];

const REMOVE_TAGS = ['script', 'style', 'noscript', 'svg', 'path', 'iframe'];
const CONDITIONAL_REMOVE_TAGS = ['nav', 'footer', 'header'];
const KEEP_ATTRIBUTES = new Set(['class', 'id', 'href']);

/**
 * Strip HTML down to schedule-relevant content for AI consumption.
 * Target: ~2,000-5,000 tokens output from typical gym website.
 */
export function cleanHtmlForAI(html: string): string {
  if (!html.trim()) return '';

  const $ = cheerio.load(html);

  // Remove always-removed tags
  for (const tag of REMOVE_TAGS) {
    $(tag).remove();
  }

  // Conditionally remove nav/header/footer — only if they don't contain schedule content
  for (const tag of CONDITIONAL_REMOVE_TAGS) {
    $(tag).each((_, el) => {
      const text = $(el).text().toLowerCase();
      const hasScheduleKeyword = SCHEDULE_KEYWORDS.some((kw) => text.includes(kw));
      if (!hasScheduleKeyword) {
        $(el).remove();
      }
    });
  }

  // Remove HTML comments
  $('*').contents().filter(function () {
    return this.type === 'comment';
  }).remove();

  // Strip non-essential attributes
  $('*').each((_, el) => {
    const $el = $(el);
    const attribs = (el as Element).attribs;
    if (attribs) {
      for (const attr of Object.keys(attribs)) {
        if (!KEEP_ATTRIBUTES.has(attr)) {
          $el.removeAttr(attr);
        }
      }
    }
  });

  // Get cleaned HTML
  let cleaned = $('body').html() ?? $.html();

  // Collapse whitespace
  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '>\n<')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // If still very large (>60KB ~15K tokens), extract the schedule-dense section
  if (cleaned.length > 60_000) {
    cleaned = extractScheduleSection(cleaned);
  }

  return cleaned;
}

/**
 * When HTML is too large, find the section with the highest density of
 * day-name references and return a window around it.
 */
function extractScheduleSection(html: string): string {
  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const lower = html.toLowerCase();
  const windowSize = 20_000; // ~5K tokens

  let bestStart = 0;
  let bestCount = 0;

  for (let i = 0; i < lower.length - windowSize; i += 1000) {
    const window = lower.slice(i, i + windowSize);
    const count = DAYS.reduce((sum, day) => sum + (window.split(day).length - 1), 0);
    if (count > bestCount) {
      bestCount = count;
      bestStart = i;
    }
  }

  return html.slice(bestStart, bestStart + windowSize);
}
