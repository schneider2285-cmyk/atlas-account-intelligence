import { describe, it, expect } from 'vitest';
import { validateAndNormalize, validateAIExtraction } from '../validate';
import type { ExtractedOpenMat, AIExtractedOpenMat } from '../types';

const baseItem: ExtractedOpenMat = {
  className: 'Open Mat',
  dayOfWeek: 6,
  startTime: '12:00',
  endTime: '14:00',
  rawText: 'saturday 12:00 - 2:00 pm - Open Mat',
};

describe('validateAndNormalize', () => {
  it('validates a normal open mat entry', () => {
    const results = validateAndNormalize([baseItem], 'gym-123', 'https://example.com/schedule', 0.9, false);
    expect(results).toHaveLength(1);
    expect(results[0].gym_id).toBe('gym-123');
    expect(results[0].day_of_week).toBe(6);
    expect(results[0].start_time).toBe('12:00:00');
    expect(results[0].end_time).toBe('14:00:00');
    expect(results[0].type).toBe('both');
    expect(results[0].recurring).toBe(true);
    expect(results[0].source_type).toBe('website_scrape');
    expect(results[0].confidence_score).toBe('medium');
    expect(results[0].needs_review).toBe(false);
  });

  it('defaults end_time to start+2h if missing', () => {
    const noEnd: ExtractedOpenMat = { ...baseItem, endTime: null };
    const results = validateAndNormalize([noEnd], 'gym-123', 'https://example.com', 0.9, false);
    expect(results[0].end_time).toBe('14:00:00');
  });

  it('skips entries with start >= end', () => {
    const bad: ExtractedOpenMat = { ...baseItem, startTime: '14:00', endTime: '12:00' };
    const results = validateAndNormalize([bad], 'gym-123', 'https://example.com', 0.9, false);
    expect(results).toHaveLength(0);
  });

  it('skips entries with unreasonable times (before 5am)', () => {
    const early: ExtractedOpenMat = { ...baseItem, startTime: '03:00', endTime: '05:00' };
    const results = validateAndNormalize([early], 'gym-123', 'https://example.com', 0.9, false);
    expect(results).toHaveLength(0);
  });

  it('detects no-gi from class name', () => {
    const nogi: ExtractedOpenMat = { ...baseItem, className: 'No-Gi Open Mat' };
    const results = validateAndNormalize([nogi], 'gym-123', 'https://example.com', 0.9, false);
    expect(results[0].type).toBe('nogi');
  });

  it('detects kids age policy', () => {
    const kids: ExtractedOpenMat = { ...baseItem, className: 'Kids Open Mat' };
    const results = validateAndNormalize([kids], 'gym-123', 'https://example.com', 0.9, false);
    expect(results[0].age_policy).toBe('kids_separate');
  });

  it('maps confidence correctly', () => {
    // High parser confidence -> medium
    const high = validateAndNormalize([baseItem], 'g', 'u', 0.9, false);
    expect(high[0].confidence_score).toBe('medium');

    // Medium parser confidence -> low
    const med = validateAndNormalize([baseItem], 'g', 'u', 0.5, false);
    expect(med[0].confidence_score).toBe('low');

    // Low parser confidence -> unverified
    const low = validateAndNormalize([baseItem], 'g', 'u', 0.2, false);
    expect(low[0].confidence_score).toBe('unverified');
  });

  it('sets needs_review flag', () => {
    const results = validateAndNormalize([baseItem], 'gym-123', 'https://example.com', 0.9, true);
    expect(results[0].needs_review).toBe(true);
  });
});

describe('validateAIExtraction sourceType', () => {
  const baseOpenMat: AIExtractedOpenMat = {
    class_name: 'Open Mat',
    day_of_week: 6,
    start_time: '12:00',
    end_time: '14:00',
    type: 'both',
    recurring: true,
    women_only: false,
  };

  it('sets source_type to google_search when sourceType is google_search', () => {
    const result = validateAIExtraction([baseOpenMat], 'gym-123', 'https://example.com', 'google_search', null);
    expect(result[0].source_type).toBe('google_search');
    expect(result[0].confidence_score).toBe('low');
    expect(result[0].needs_review).toBe(true);
    expect(result[0].confirmation_method).toBe('social_media');
  });

  it('sets source_type to website_scrape when sourceType is website_scrape', () => {
    const result = validateAIExtraction([baseOpenMat], 'gym-123', 'https://example.com', 'website_scrape', null);
    expect(result[0].source_type).toBe('website_scrape');
    expect(result[0].confidence_score).toBe('medium');
    expect(result[0].needs_review).toBe(false);
    expect(result[0].confirmation_method).toBe('website_scrape');
  });

  it('sets source_type to image_ocr when sourceType is image_ocr', () => {
    const result = validateAIExtraction([baseOpenMat], 'gym-123', 'https://example.com', 'image_ocr', null);
    expect(result[0].source_type).toBe('image_ocr');
    expect(result[0].confidence_score).toBe('low');
    expect(result[0].needs_review).toBe(true);
    expect(result[0].confirmation_method).toBe('website_scrape');
  });
});
