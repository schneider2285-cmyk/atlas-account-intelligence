import * as cheerio from 'cheerio';
import type { ScheduleParser, DetectionResult, ExtractedOpenMat } from '../types';
import { isOpenMatKeyword, parseTimeRange } from './shared';

const DAY_NAMES: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2,
  wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

/**
 * Generic HTML parser — scans any HTML for tables containing
 * day-of-week headers and open mat keywords in cells.
 */
export const genericHtmlParser: ScheduleParser = {
  name: 'generic-html',

  detect(html: string): DetectionResult {
    const $ = cheerio.load(html);
    const signals: string[] = [];

    $('table').each((_, table) => {
      const headerText = $(table).find('th, thead td').text().toLowerCase();
      const dayCount = Object.keys(DAY_NAMES).filter((d) => headerText.includes(d)).length;
      if (dayCount >= 3) signals.push('table_with_day_headers');
    });

    const bodyText = $('body').text().toLowerCase();
    const daysPresent = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      .filter((d) => bodyText.includes(d));
    if (daysPresent.length >= 3 && bodyText.includes('open mat')) {
      signals.push('day_names_with_open_mat_keyword');
    }

    const detected = signals.length > 0;
    return { detected, confidence: detected ? 0.5 : 0, signals };
  },

  extract(html: string): ExtractedOpenMat[] {
    const $ = cheerio.load(html);
    const results: ExtractedOpenMat[] = [];

    $('table').each((_, table) => {
      const $table = $(table);
      const headers: number[] = [];

      $table.find('tr').first().find('th, td').each((colIdx, cell) => {
        const text = $(cell).text().trim().toLowerCase();
        for (const [name, day] of Object.entries(DAY_NAMES)) {
          if (text.includes(name)) {
            headers[colIdx] = day;
            break;
          }
        }
      });

      if (headers.filter((h) => h !== undefined).length < 3) return;

      $table.find('tr').slice(1).each((_, row) => {
        $(row).find('td').each((colIdx, cell) => {
          const cellText = $(cell).text().trim();
          if (!isOpenMatKeyword(cellText)) return;

          const dayOfWeek = headers[colIdx];
          if (dayOfWeek === undefined) return;

          const { startTime, endTime } = parseTimeRange(cellText);
          if (!startTime) return;

          results.push({
            className: cellText.replace(/\d{1,2}:\d{2}\s*(am|pm)?\s*[-–]?\s*\d{0,2}:?\d{0,2}\s*(am|pm)?/gi, '').trim() || cellText,
            dayOfWeek,
            startTime,
            endTime,
            rawText: cellText,
          });
        });
      });
    });

    return results;
  },
};
