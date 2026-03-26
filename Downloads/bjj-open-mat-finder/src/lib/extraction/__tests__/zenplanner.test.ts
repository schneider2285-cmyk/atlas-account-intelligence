import { describe, it, expect } from 'vitest';
import { zenPlannerParser } from '../parsers/zenplanner';

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

describe('zenPlannerParser.detect', () => {
  it('detects Zen Planner with iframe URL + footer branding', () => {
    const html = `
      <html>
        <body>
          <iframe src="https://studio.zenplanner.com/zenplanner/portal/calendar.cfm?gymid=abc123"></iframe>
          <footer>Powered by Zen Planner</footer>
        </body>
      </html>
    `;
    const result = zenPlannerParser.detect(html);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.signals).toContain('zenplanner_url');
    expect(result.signals).toContain('footer_branding');
  });

  it('detects Zen Planner with zp- CSS classes + zenplanner URL', () => {
    const html = `
      <html>
        <head><link rel="stylesheet" href="https://cdn.zenplanner.com/styles.css" /></head>
        <body>
          <div class="zp-schedule">Schedule content</div>
        </body>
      </html>
    `;
    const result = zenPlannerParser.detect(html);
    expect(result.detected).toBe(true);
    expect(result.signals).toContain('zenplanner_url');
    expect(result.signals).toContain('zp_css_prefix');
  });

  it('detects Zen Planner with scheduleTable + calendar.cfm', () => {
    const html = `
      <html>
        <body>
          <a href="/zenplanner/portal/calendar.cfm">View Schedule</a>
          <table class="scheduleTable"><tr><th>Monday</th></tr></table>
        </body>
      </html>
    `;
    const result = zenPlannerParser.detect(html);
    expect(result.detected).toBe(true);
    expect(result.signals).toContain('portal_calendar_url');
    expect(result.signals).toContain('schedule_table_class');
  });

  it('does not detect with only one signal', () => {
    const html = `
      <html><body><footer>Powered by Zen Planner</footer></body></html>
    `;
    const result = zenPlannerParser.detect(html);
    expect(result.detected).toBe(false);
  });

  it('does not detect on unrelated HTML', () => {
    const html = `
      <html><body><h1>Welcome to our gym</h1><p>Join today!</p></body></html>
    `;
    const result = zenPlannerParser.detect(html);
    expect(result.detected).toBe(false);
    expect(result.signals).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Extraction — Table-based schedule
// ---------------------------------------------------------------------------

describe('zenPlannerParser.extract — table layout', () => {
  it('extracts open mat from a weekly table grid', () => {
    const html = `
      <html><body>
        <table class="scheduleTable">
          <thead>
            <tr>
              <th>Time</th>
              <th>Monday</th>
              <th>Tuesday</th>
              <th>Wednesday</th>
              <th>Thursday</th>
              <th>Friday</th>
              <th>Saturday</th>
              <th>Sunday</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>6:00 am - 7:00 am</td>
              <td>Fundamentals</td>
              <td>Fundamentals</td>
              <td>Fundamentals</td>
              <td>Fundamentals</td>
              <td>Fundamentals</td>
              <td></td>
              <td></td>
            </tr>
            <tr>
              <td>11:00 am - 12:30 pm</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td>Open Mat 11:00 am - 12:30 pm</td>
              <td>Open Mat 11:00 am - 12:30 pm</td>
            </tr>
          </tbody>
        </table>
      </body></html>
    `;

    const results = zenPlannerParser.extract(html);
    expect(results).toHaveLength(2);

    expect(results[0]).toMatchObject({
      className: 'Open Mat',
      dayOfWeek: 6, // Saturday
      startTime: '11:00',
      endTime: '12:30',
    });

    expect(results[1]).toMatchObject({
      className: 'Open Mat',
      dayOfWeek: 0, // Sunday
      startTime: '11:00',
      endTime: '12:30',
    });
  });

  it('uses row time when cell does not contain time', () => {
    const html = `
      <html><body>
        <table class="scheduleTable">
          <thead>
            <tr><th></th><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Saturday</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>12:00 pm - 2:00 pm</td>
              <td></td>
              <td></td>
              <td></td>
              <td>Open Mat</td>
            </tr>
          </tbody>
        </table>
      </body></html>
    `;

    const results = zenPlannerParser.extract(html);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      className: 'Open Mat',
      dayOfWeek: 6,
      startTime: '12:00',
      endTime: '14:00',
    });
  });

  it('ignores non-open-mat classes', () => {
    const html = `
      <html><body>
        <table>
          <thead>
            <tr><th></th><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Saturday</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>9:00 am - 10:00 am</td>
              <td>Gi Fundamentals</td>
              <td>No-Gi Advanced</td>
              <td>Kids Class</td>
              <td>Competition Training</td>
            </tr>
          </tbody>
        </table>
      </body></html>
    `;

    const results = zenPlannerParser.extract(html);
    expect(results).toHaveLength(0);
  });

  it('ignores open enrollment (false positive)', () => {
    const html = `
      <html><body>
        <table>
          <thead>
            <tr><th></th><th>Monday</th><th>Wednesday</th><th>Friday</th><th>Saturday</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>10:00 am - 11:00 am</td>
              <td>Open Enrollment Period</td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </body></html>
    `;

    const results = zenPlannerParser.extract(html);
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Extraction — Day section layout
// ---------------------------------------------------------------------------

describe('zenPlannerParser.extract — day section layout', () => {
  it('extracts open mat from day-heading + class-list layout', () => {
    const html = `
      <html><body>
        <div class="schedule">
          <h3>Saturday</h3>
          <div>Fundamentals 9:00 am - 10:00 am</div>
          <div>Open Mat 10:00 am - 12:00 pm</div>
          <h3>Sunday</h3>
          <div>Open Roll 11:00 am - 1:00 pm</div>
        </div>
      </body></html>
    `;

    const results = zenPlannerParser.extract(html);
    expect(results).toHaveLength(2);

    expect(results[0]).toMatchObject({
      className: 'Open Mat',
      dayOfWeek: 6,
      startTime: '10:00',
      endTime: '12:00',
    });

    expect(results[1]).toMatchObject({
      className: 'Open Roll',
      dayOfWeek: 0,
      startTime: '11:00',
      endTime: '13:00',
    });
  });
});

// ---------------------------------------------------------------------------
// Extraction — Calendar entry blocks
// ---------------------------------------------------------------------------

describe('zenPlannerParser.extract — calendar entry blocks', () => {
  it('extracts open mat from calendarEntry blocks with data-day', () => {
    const html = `
      <html><body>
        <div class="calendarEntry" data-day="6">
          Saturday Open Mat 10:00 am - 12:00 pm
        </div>
        <div class="calendarEntry" data-day="1">
          Monday Advanced Class 6:00 pm - 7:30 pm
        </div>
      </body></html>
    `;

    const results = zenPlannerParser.extract(html);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      dayOfWeek: 6,
      startTime: '10:00',
      endTime: '12:00',
    });
  });

  it('extracts open mat from scheduleEntry blocks with day in text', () => {
    const html = `
      <html><body>
        <div class="scheduleEntry">
          Sunday Free Roll 2:00 pm - 4:00 pm
        </div>
      </body></html>
    `;

    const results = zenPlannerParser.extract(html);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      className: expect.stringContaining('Free Roll'),
      dayOfWeek: 0,
      startTime: '14:00',
      endTime: '16:00',
    });
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('zenPlannerParser.extract — edge cases', () => {
  it('returns empty array for HTML with no schedule', () => {
    const html = '<html><body><p>Welcome to our gym</p></body></html>';
    expect(zenPlannerParser.extract(html)).toEqual([]);
  });

  it('returns empty array for table without enough day columns', () => {
    const html = `
      <html><body>
        <table>
          <thead><tr><th>Item</th><th>Price</th></tr></thead>
          <tbody><tr><td>Gi</td><td>$150</td></tr></tbody>
        </table>
      </body></html>
    `;
    expect(zenPlannerParser.extract(html)).toEqual([]);
  });

  it('handles multiple open mat keywords', () => {
    const html = `
      <html><body>
        <table>
          <thead>
            <tr><th></th><th>Monday</th><th>Wednesday</th><th>Friday</th><th>Saturday</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>10:00 am - 12:00 pm</td>
              <td></td>
              <td></td>
              <td></td>
              <td>Open Training 10:00 am - 12:00 pm</td>
            </tr>
            <tr>
              <td>1:00 pm - 3:00 pm</td>
              <td></td>
              <td></td>
              <td>Open Gym 1:00 pm - 3:00 pm</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </body></html>
    `;

    const results = zenPlannerParser.extract(html);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.dayOfWeek).sort()).toEqual([5, 6]);
  });
});
