import * as cheerio from 'cheerio';
import type { ScheduleParser, DetectionResult, ExtractedOpenMat } from '../types';
import { isOpenMatKeyword, parseTimeRange } from './shared';

const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

/**
 * Kicksite parser — uses the mobile schedule view which has a clean
 * day → time → class structure.
 *
 * Mobile structure:
 *   .mobile-schedule
 *     .schedule-day
 *       .mobile-schedule-day > h3 "Saturday"
 *       .mobile-time "12:00 - 2:00 pm"
 *       .mobile-classes > .mobile-day-class.OpenMat "Open Mat"
 */
export const kicksiteParser: ScheduleParser = {
  name: 'kicksite',

  detect(html: string): DetectionResult {
    const signals: string[] = [];
    const lower = html.toLowerCase();

    if (lower.includes('powered by kicksite')) signals.push('footer_branding');
    if (html.includes('mobile-schedule')) signals.push('mobile_schedule');
    if (html.includes('schedule-container')) signals.push('schedule_container');
    if (html.includes('page-section-schedule')) signals.push('page_section');

    const detected = signals.length >= 2;
    const confidence = Math.min(1.0, signals.length * 0.3);

    return { detected, confidence, signals };
  },

  extract(html: string): ExtractedOpenMat[] {
    const $ = cheerio.load(html);
    const results: ExtractedOpenMat[] = [];

    const mobileSchedule = $('.mobile-schedule');
    if (mobileSchedule.length === 0) return results;

    mobileSchedule.find('.schedule-day').each((_, daySection) => {
      const $day = $(daySection);

      const dayName = $day.find('.mobile-schedule-day h3').first().text().trim().toLowerCase();
      if (!(dayName in DAY_MAP)) return;
      const currentDay = DAY_MAP[dayName];

      const times = $day.find('.mobile-time');
      const classGroups = $day.find('.mobile-classes');

      times.each((i, timeEl) => {
        const timeText = $(timeEl).text().trim();
        const classGroup = classGroups.eq(i);

        classGroup.find('[class*="mobile-day-class"]').each((_, classEl) => {
          const className = $(classEl).text().trim();

          if (isOpenMatKeyword(className)) {
            const { startTime, endTime } = parseTimeRange(timeText);
            if (startTime) {
              results.push({
                className,
                dayOfWeek: currentDay,
                startTime,
                endTime,
                rawText: `${dayName} ${timeText} - ${className}`,
              });
            }
          }
        });
      });
    });

    return results;
  },
};
