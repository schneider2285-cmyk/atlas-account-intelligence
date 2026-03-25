import * as cheerio from 'cheerio';
import { fetchPage } from './fetch';
import type { ScheduleDiscoveryResult } from './types';

const CONVENTION_PATHS = [
  '/schedule',
  '/class-schedule',
  '/classes',
  '/timetable',
  '/programs',
  '/weekly-schedule',
];

const SCHEDULE_LINK_KEYWORDS = ['schedule', 'class', 'timetable', 'program', 'calendar'];
const SCHEDULE_CONTENT_SIGNALS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * Stage 2: Find the schedule page URL for a gym website.
 *
 * Strategy:
 * 1. Convention probing — try common URL paths
 * 2. Homepage link crawl — find links with schedule keywords
 * 3. Homepage-as-schedule — check if homepage itself has schedule content
 */
export async function discoverScheduleUrl(
  baseUrl: string,
  homepageHtml: string
): Promise<ScheduleDiscoveryResult | null> {
  const base = baseUrl.replace(/\/+$/, '');

  // Strategy 1: Convention probing
  for (const path of CONVENTION_PATHS) {
    const url = `${base}${path}`;
    const result = await fetchPage(url);
    if (result && hasScheduleContent(result.html)) {
      return { scheduleUrl: result.finalUrl, scheduleHtml: result.html };
    }
  }

  // Strategy 2: Homepage link crawl
  const $ = cheerio.load(homepageHtml);
  const links: { url: string; score: number }[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().toLowerCase();
    const hrefLower = href.toLowerCase();

    let score = 0;
    for (const kw of SCHEDULE_LINK_KEYWORDS) {
      if (hrefLower.includes(kw)) score += 2;
      if (text.includes(kw)) score += 1;
    }

    if (score > 0) {
      let fullUrl: string;
      try {
        fullUrl = new URL(href, base).href;
      } catch {
        return;
      }
      links.push({ url: fullUrl, score });
    }
  });

  links.sort((a, b) => b.score - a.score);

  for (const link of links.slice(0, 3)) {
    const result = await fetchPage(link.url);
    if (result && hasScheduleContent(result.html)) {
      return { scheduleUrl: result.finalUrl, scheduleHtml: result.html };
    }
  }

  // Strategy 3: Homepage itself has schedule content
  if (hasScheduleContent(homepageHtml)) {
    return { scheduleUrl: base, scheduleHtml: homepageHtml };
  }

  return null;
}

function hasScheduleContent(html: string): boolean {
  const lower = html.toLowerCase();
  const daysFound = SCHEDULE_CONTENT_SIGNALS.filter((day) => lower.includes(day));
  return daysFound.length >= 3;
}
