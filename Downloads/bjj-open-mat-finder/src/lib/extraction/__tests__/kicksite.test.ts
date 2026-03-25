import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { kicksiteParser } from '../parsers/kicksite';

const fixtureHtml = readFileSync(
  join(__dirname, 'fixtures', 'kicksite-schedule.html'),
  'utf-8'
);

describe('kicksiteParser.detect', () => {
  it('detects Kicksite from real fixture', () => {
    const result = kicksiteParser.detect(fixtureHtml);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    expect(result.signals.length).toBeGreaterThanOrEqual(2);
  });

  it('does not detect from plain HTML', () => {
    const result = kicksiteParser.detect('<html><body><p>Hello</p></body></html>');
    expect(result.detected).toBe(false);
  });
});

describe('kicksiteParser.extract', () => {
  it('extracts open mat from real Kicksite fixture', () => {
    const results = kicksiteParser.extract(fixtureHtml);
    expect(results.length).toBeGreaterThanOrEqual(1);

    const openMat = results[0];
    expect(openMat.className).toMatch(/open mat/i);
    expect(openMat.dayOfWeek).toBeGreaterThanOrEqual(0);
    expect(openMat.dayOfWeek).toBeLessThanOrEqual(6);
    expect(openMat.startTime).toBe('12:00');
    expect(openMat.endTime).toBe('14:00');
  });

  it('returns empty for non-Kicksite HTML', () => {
    const results = kicksiteParser.extract('<html><body></body></html>');
    expect(results).toEqual([]);
  });
});
