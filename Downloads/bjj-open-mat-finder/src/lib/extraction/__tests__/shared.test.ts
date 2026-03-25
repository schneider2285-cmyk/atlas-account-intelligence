import { describe, it, expect } from 'vitest';
import { isOpenMatKeyword, parseTimeRange } from '../parsers/shared';

describe('isOpenMatKeyword', () => {
  it('matches "Open Mat"', () => {
    expect(isOpenMatKeyword('Open Mat')).toBe(true);
  });

  it('matches "Adult Open Mat"', () => {
    expect(isOpenMatKeyword('Adult Open Mat')).toBe(true);
  });

  it('matches "open roll"', () => {
    expect(isOpenMatKeyword('open roll')).toBe(true);
  });

  it('matches "Free Roll"', () => {
    expect(isOpenMatKeyword('Free Roll')).toBe(true);
  });

  it('matches "open training"', () => {
    expect(isOpenMatKeyword('open training')).toBe(true);
  });

  it('rejects "open enrollment"', () => {
    expect(isOpenMatKeyword('open enrollment')).toBe(false);
  });

  it('rejects "open house"', () => {
    expect(isOpenMatKeyword('open house')).toBe(false);
  });

  it('rejects "open door"', () => {
    expect(isOpenMatKeyword('open door')).toBe(false);
  });

  it('rejects regular class names', () => {
    expect(isOpenMatKeyword('Fundamentals')).toBe(false);
    expect(isOpenMatKeyword('Competition Training')).toBe(false);
    expect(isOpenMatKeyword('Kids BJJ')).toBe(false);
  });
});

describe('parseTimeRange', () => {
  it('parses "12:00 - 2:00 pm"', () => {
    const result = parseTimeRange('12:00 - 2:00 pm');
    expect(result.startTime).toBe('12:00');
    expect(result.endTime).toBe('14:00');
  });

  it('parses "6:00 - 7:30 am"', () => {
    const result = parseTimeRange('6:00 - 7:30 am');
    expect(result.startTime).toBe('06:00');
    expect(result.endTime).toBe('07:30');
  });

  it('parses "10:00 am - 12:00 pm"', () => {
    const result = parseTimeRange('10:00 am - 12:00 pm');
    expect(result.startTime).toBe('10:00');
    expect(result.endTime).toBe('12:00');
  });

  it('parses "7:00 - 8:30 pm"', () => {
    const result = parseTimeRange('7:00 - 8:30 pm');
    expect(result.startTime).toBe('19:00');
    expect(result.endTime).toBe('20:30');
  });

  it('returns null for unparseable text', () => {
    const result = parseTimeRange('No time here');
    expect(result.startTime).toBeNull();
    expect(result.endTime).toBeNull();
  });
});
