import { describe, it, expect } from 'vitest';
import { cleanHtmlForAI } from '../clean-html';

describe('cleanHtmlForAI', () => {
  it('removes script tags and contents', () => {
    const html = '<html><body><p>Schedule</p><script>alert("x")</script></body></html>';
    const result = cleanHtmlForAI(html);
    expect(result).not.toContain('script');
    expect(result).not.toContain('alert');
    expect(result).toContain('Schedule');
  });

  it('removes style tags and contents', () => {
    const html = '<html><body><p>Monday</p><style>.foo{color:red}</style></body></html>';
    const result = cleanHtmlForAI(html);
    expect(result).not.toContain('style');
    expect(result).not.toContain('color');
    expect(result).toContain('Monday');
  });

  it('removes nav/footer/header when they lack schedule keywords', () => {
    const html = `<html><body>
      <header><a href="/">Logo</a></header>
      <main><p>Monday Open Mat 12:00 PM</p></main>
      <footer>Copyright 2026</footer>
    </body></html>`;
    const result = cleanHtmlForAI(html);
    expect(result).not.toContain('Logo');
    expect(result).not.toContain('Copyright');
    expect(result).toContain('Monday Open Mat');
  });

  it('preserves nav/footer/header when they contain schedule keywords', () => {
    const html = `<html><body>
      <header><a href="/schedule">Schedule</a></header>
      <footer><p>Saturday Open Mat 10:00 AM</p></footer>
    </body></html>`;
    const result = cleanHtmlForAI(html);
    expect(result).toContain('Schedule');
    expect(result).toContain('Saturday Open Mat');
  });

  it('strips most HTML attributes but keeps class and id', () => {
    const html = '<div class="schedule" id="main" style="color:red" data-foo="bar"><p>Monday</p></div>';
    const result = cleanHtmlForAI(html);
    expect(result).toContain('class="schedule"');
    expect(result).toContain('id="main"');
    expect(result).not.toContain('style=');
    expect(result).not.toContain('data-foo');
  });

  it('collapses whitespace', () => {
    const html = '<html><body><p>Monday     10:00      AM</p></body></html>';
    const result = cleanHtmlForAI(html);
    expect(result).not.toMatch(/\s{3,}/);
  });

  it('removes SVG elements', () => {
    const html = '<html><body><svg><path d="M0,0"/></svg><p>Open Mat</p></body></html>';
    const result = cleanHtmlForAI(html);
    expect(result).not.toContain('svg');
    expect(result).not.toContain('path');
    expect(result).toContain('Open Mat');
  });

  it('handles empty HTML gracefully', () => {
    expect(cleanHtmlForAI('')).toBe('');
    expect(cleanHtmlForAI('<html></html>')).toBeDefined();
  });
});
