import { describe, it, expect } from 'vitest';
import { mindbodyParser } from '../parsers/mindbody';

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

describe('mindbodyParser.detect', () => {
  it('detects MindBody with healcode script + widget element', () => {
    const html = `
      <html>
        <body>
          <healcode-widget data-type="schedules" data-widget-partner="object"
            data-widget-id="abc123" data-widget-version="1"></healcode-widget>
          <script src="https://widgets.mindbodyonline.com/javascripts/healcode.js"></script>
        </body>
      </html>
    `;
    const result = mindbodyParser.detect(html);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.signals).toContain('healcode_script');
    expect(result.signals).toContain('healcode_widget_element');
    expect(result.signals).toContain('mindbody_url');
    expect(result.signals).toContain('widget_data_attributes');
  });

  it('detects MindBody with branded footer + mindbody URL', () => {
    const html = `
      <html>
        <body>
          <iframe src="https://clients.mindbodyonline.com/classic/ws?studioid=12345"></iframe>
          <footer>Powered by Mindbody</footer>
        </body>
      </html>
    `;
    const result = mindbodyParser.detect(html);
    expect(result.detected).toBe(true);
    expect(result.signals).toContain('mindbody_url');
    expect(result.signals).toContain('footer_branding');
    expect(result.signals).toContain('clients_portal_url');
  });

  it('detects MindBody with bw- CSS classes + healcode', () => {
    const html = `
      <html>
        <body>
          <div class="healcode-widget">
            <div class="bw-widget">
              <div class="bw-session">Open Mat</div>
            </div>
          </div>
        </body>
      </html>
    `;
    const result = mindbodyParser.detect(html);
    expect(result.detected).toBe(true);
    expect(result.signals).toContain('healcode_script');
    expect(result.signals).toContain('healcode_widget_element');
    expect(result.signals).toContain('bw_css_classes');
  });

  it('does not detect with only one signal', () => {
    const html = `
      <html><body><footer>Powered by Mindbody</footer></body></html>
    `;
    const result = mindbodyParser.detect(html);
    expect(result.detected).toBe(false);
  });

  it('does not detect on unrelated HTML', () => {
    const html = `
      <html><body><h1>Local BJJ Academy</h1><p>Sign up today!</p></body></html>
    `;
    const result = mindbodyParser.detect(html);
    expect(result.detected).toBe(false);
    expect(result.signals).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Extraction — Branded Web session blocks
// ---------------------------------------------------------------------------

describe('mindbodyParser.extract — bw-session blocks', () => {
  it('extracts open mat from grouped bw-session blocks', () => {
    const html = `
      <html><body>
        <div class="bw-widget">
          <div class="bw-widget__day">
            <div class="bw-widget__day-name">Saturday, March 29</div>
            <div class="bw-session">
              <div class="bw-session__time">10:00 am - 11:30 am</div>
              <div class="bw-session__name">Advanced No-Gi</div>
            </div>
            <div class="bw-session">
              <div class="bw-session__time">12:00 pm - 2:00 pm</div>
              <div class="bw-session__name">Open Mat</div>
            </div>
          </div>
          <div class="bw-widget__day">
            <div class="bw-widget__day-name">Sunday, March 30</div>
            <div class="bw-session">
              <div class="bw-session__time">11:00 am - 1:00 pm</div>
              <div class="bw-session__name">Open Roll</div>
            </div>
          </div>
        </div>
      </body></html>
    `;

    const results = mindbodyParser.extract(html);
    expect(results).toHaveLength(2);

    expect(results[0]).toMatchObject({
      className: 'Open Mat',
      dayOfWeek: 6, // Saturday
      startTime: '12:00',
      endTime: '14:00',
    });

    expect(results[1]).toMatchObject({
      className: 'Open Roll',
      dayOfWeek: 0, // Sunday
      startTime: '11:00',
      endTime: '13:00',
    });
  });

  it('extracts from standalone bw-session with date child', () => {
    const html = `
      <html><body>
        <div class="bw-widget">
          <div class="bw-session">
            <div class="bw-session__date">Saturday</div>
            <div class="bw-session__time">1:00 pm - 3:00 pm</div>
            <div class="bw-session__name">Open Mat</div>
          </div>
        </div>
      </body></html>
    `;

    const results = mindbodyParser.extract(html);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      className: 'Open Mat',
      dayOfWeek: 6,
      startTime: '13:00',
      endTime: '15:00',
    });
  });

  it('ignores non-open-mat sessions', () => {
    const html = `
      <html><body>
        <div class="bw-widget">
          <div class="bw-widget__day">
            <div class="bw-widget__day-name">Monday</div>
            <div class="bw-session">
              <div class="bw-session__time">6:00 am - 7:00 am</div>
              <div class="bw-session__name">Fundamentals</div>
            </div>
            <div class="bw-session">
              <div class="bw-session__time">7:00 pm - 8:30 pm</div>
              <div class="bw-session__name">Advanced Gi</div>
            </div>
          </div>
        </div>
      </body></html>
    `;

    const results = mindbodyParser.extract(html);
    expect(results).toHaveLength(0);
  });

  it('deduplicates identical sessions', () => {
    // A session that appears both as grouped and standalone should not be doubled
    const html = `
      <html><body>
        <div class="bw-widget">
          <div class="bw-widget__day">
            <div class="bw-widget__day-name">Saturday</div>
            <div class="bw-session">
              <div class="bw-session__date">Saturday</div>
              <div class="bw-session__time">12:00 pm - 2:00 pm</div>
              <div class="bw-session__name">Open Mat</div>
            </div>
          </div>
        </div>
      </body></html>
    `;

    const results = mindbodyParser.extract(html);
    expect(results).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Extraction — HealCode widget rendered schedule
// ---------------------------------------------------------------------------

describe('mindbodyParser.extract — healcode widget', () => {
  it('extracts from healcode class entries', () => {
    const html = `
      <html><body>
        <div class="healcode-widget">
          <div class="hc_class">
            <span class="hc_class_date">Saturday, March 29</span>
            <span class="hc_class_time">10:00 am - 12:00 pm</span>
            <span class="hc_class_name">Open Mat</span>
          </div>
          <div class="hc_class">
            <span class="hc_class_date">Monday, March 31</span>
            <span class="hc_class_time">6:00 pm - 7:00 pm</span>
            <span class="hc_class_name">Gi Class</span>
          </div>
        </div>
      </body></html>
    `;

    const results = mindbodyParser.extract(html);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      className: 'Open Mat',
      dayOfWeek: 6,
      startTime: '10:00',
      endTime: '12:00',
    });
  });

  it('extracts from healcode widget with table layout', () => {
    const html = `
      <html><body>
        <div class="healcode-widget">
          <table>
            <thead>
              <tr><th></th><th>Monday</th><th>Wednesday</th><th>Friday</th><th>Saturday</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>11:00 am - 1:00 pm</td>
                <td></td>
                <td></td>
                <td></td>
                <td>Open Mat 11:00 am - 1:00 pm</td>
              </tr>
            </tbody>
          </table>
        </div>
      </body></html>
    `;

    const results = mindbodyParser.extract(html);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      className: 'Open Mat',
      dayOfWeek: 6,
      startTime: '11:00',
      endTime: '13:00',
    });
  });
});

// ---------------------------------------------------------------------------
// Extraction — MindBody table schedule
// ---------------------------------------------------------------------------

describe('mindbodyParser.extract — mb-schedule table', () => {
  it('extracts from a mb-schedule table with day columns', () => {
    const html = `
      <html><body>
        <table class="mb-schedule">
          <thead>
            <tr>
              <th>Time</th>
              <th>Monday</th>
              <th>Tuesday</th>
              <th>Wednesday</th>
              <th>Thursday</th>
              <th>Friday</th>
              <th>Saturday</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>9:00 am - 10:00 am</td>
              <td>Fundamentals</td>
              <td></td>
              <td>Fundamentals</td>
              <td></td>
              <td>Fundamentals</td>
              <td></td>
            </tr>
            <tr>
              <td>10:00 am - 12:00 pm</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td>Free Roll 10:00 am - 12:00 pm</td>
            </tr>
          </tbody>
        </table>
      </body></html>
    `;

    const results = mindbodyParser.extract(html);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      className: 'Free Roll',
      dayOfWeek: 6,
      startTime: '10:00',
      endTime: '12:00',
    });
  });
});

// ---------------------------------------------------------------------------
// Extraction — Day-grouped list
// ---------------------------------------------------------------------------

describe('mindbodyParser.extract — day-grouped list', () => {
  it('extracts from headings + sibling class entries', () => {
    const html = `
      <html><body>
        <h3>Saturday</h3>
        <div>Fundamentals 9:00 am - 10:00 am</div>
        <div>Open Mat 10:00 am - 12:00 pm</div>
        <h3>Sunday</h3>
        <div>Open Training 11:00 am - 1:00 pm</div>
      </body></html>
    `;

    const results = mindbodyParser.extract(html);
    expect(results).toHaveLength(2);

    expect(results[0]).toMatchObject({
      dayOfWeek: 6,
      startTime: '10:00',
      endTime: '12:00',
    });

    expect(results[1]).toMatchObject({
      dayOfWeek: 0,
      startTime: '11:00',
      endTime: '13:00',
    });
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('mindbodyParser.extract — edge cases', () => {
  it('returns empty array for HTML with no schedule', () => {
    const html = '<html><body><p>Welcome to our gym</p></body></html>';
    expect(mindbodyParser.extract(html)).toEqual([]);
  });

  it('returns empty array for session without time', () => {
    const html = `
      <html><body>
        <div class="bw-widget">
          <div class="bw-widget__day">
            <div class="bw-widget__day-name">Saturday</div>
            <div class="bw-session">
              <div class="bw-session__time">TBD</div>
              <div class="bw-session__name">Open Mat</div>
            </div>
          </div>
        </div>
      </body></html>
    `;
    expect(mindbodyParser.extract(html)).toEqual([]);
  });

  it('returns empty array for session without day', () => {
    const html = `
      <html><body>
        <div class="bw-widget">
          <div class="bw-session">
            <div class="bw-session__time">12:00 pm - 2:00 pm</div>
            <div class="bw-session__name">Open Mat</div>
          </div>
        </div>
      </body></html>
    `;
    expect(mindbodyParser.extract(html)).toEqual([]);
  });

  it('excludes open enrollment false positives', () => {
    const html = `
      <html><body>
        <div class="bw-widget">
          <div class="bw-widget__day">
            <div class="bw-widget__day-name">Monday</div>
            <div class="bw-session">
              <div class="bw-session__time">9:00 am - 10:00 am</div>
              <div class="bw-session__name">Open Enrollment</div>
            </div>
          </div>
        </div>
      </body></html>
    `;
    expect(mindbodyParser.extract(html)).toEqual([]);
  });

  it('handles all open mat keyword variants', () => {
    const html = `
      <html><body>
        <div class="bw-widget">
          <div class="bw-widget__day">
            <div class="bw-widget__day-name">Saturday</div>
            <div class="bw-session">
              <div class="bw-session__time">10:00 am - 11:00 am</div>
              <div class="bw-session__name">Open Mat</div>
            </div>
            <div class="bw-session">
              <div class="bw-session__time">11:00 am - 12:00 pm</div>
              <div class="bw-session__name">Open Roll</div>
            </div>
            <div class="bw-session">
              <div class="bw-session__time">12:00 pm - 1:00 pm</div>
              <div class="bw-session__name">Free Roll</div>
            </div>
            <div class="bw-session">
              <div class="bw-session__time">1:00 pm - 2:00 pm</div>
              <div class="bw-session__name">Open Training</div>
            </div>
            <div class="bw-session">
              <div class="bw-session__time">2:00 pm - 3:00 pm</div>
              <div class="bw-session__name">Open Gym</div>
            </div>
          </div>
        </div>
      </body></html>
    `;

    const results = mindbodyParser.extract(html);
    expect(results).toHaveLength(5);
    expect(results.map((r) => r.className)).toEqual([
      'Open Mat', 'Open Roll', 'Free Roll', 'Open Training', 'Open Gym',
    ]);
  });
});
