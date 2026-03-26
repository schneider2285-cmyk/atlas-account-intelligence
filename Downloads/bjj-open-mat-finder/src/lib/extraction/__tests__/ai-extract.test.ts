import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCreate = vi.fn();

// Mock the Anthropic SDK — must use a class/function constructor
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

import { extractWithAI } from '../ai-extract';

describe('extractWithAI', () => {
  const origKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    mockCreate.mockReset();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (origKey) {
      process.env.ANTHROPIC_API_KEY = origKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('parses tool_use response with open mats', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'tool_use',
        name: 'report_open_mats',
        input: {
          open_mats: [
            {
              class_name: 'Open Mat',
              day_of_week: 6,
              start_time: '12:00',
              end_time: '14:00',
              type: 'both',
              recurring: true,
              women_only: false,
              drop_in_fee: { free: true, unknown: false },
              visitor_access: 'open_to_all',
              intensity: 'casual',
            }
          ],
          schedule_page_found: true,
          confidence_note: null,
        },
      }],
      usage: { input_tokens: 500, output_tokens: 100 },
    });

    const result = await extractWithAI('<div>Saturday 12:00 PM - 2:00 PM Open Mat</div>');

    expect(result.openMats).toHaveLength(1);
    expect(result.openMats[0].class_name).toBe('Open Mat');
    expect(result.openMats[0].day_of_week).toBe(6);
    expect(result.openMats[0].start_time).toBe('12:00');
    expect(result.schedulePageFound).toBe(true);
    expect(result.tokensUsed.input).toBe(500);
  });

  it('returns empty array when no open mats found', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'tool_use',
        name: 'report_open_mats',
        input: {
          open_mats: [],
          schedule_page_found: true,
          confidence_note: 'Schedule found but no open mat sessions listed',
        },
      }],
      usage: { input_tokens: 500, output_tokens: 50 },
    });

    const result = await extractWithAI('<div>Monday: Fundamentals 6pm</div>');
    expect(result.openMats).toHaveLength(0);
    expect(result.schedulePageFound).toBe(true);
  });

  it('returns empty result on API error', async () => {
    mockCreate.mockRejectedValue(new Error('API timeout'));

    const result = await extractWithAI('<div>Schedule</div>');
    expect(result.openMats).toHaveLength(0);
    expect(result.schedulePageFound).toBe(false);
  });

  it('handles missing ANTHROPIC_API_KEY gracefully', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const result = await extractWithAI('<div>Schedule</div>');
    expect(result.openMats).toHaveLength(0);
    expect(result.schedulePageFound).toBe(false);
  });
});
