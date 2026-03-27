import Anthropic from '@anthropic-ai/sdk';
import type { AIExtractedOpenMat, AIExtractionResult } from './types';

const SYSTEM_PROMPT = `You are an expert BJJ (Brazilian Jiu-Jitsu) gym schedule analyst. Your goal is to find ALL open mat sessions — even when they aren't explicitly labeled "open mat."

## What is an open mat?
A session where practitioners roll (spar/grapple) freely without structured instruction. May or may not have a coach present. This is the MOST important thing BJJ practitioners look for when visiting a new gym.

## Explicit open mat names (high confidence)
Open Mat, Open Roll, Free Roll, Free Rolling, Rolling, Mat Time, Casual Rolls, Open Training, Sparring, Live Training, Free Training, Open Rolling, Freestyle Rolling, Submission Wrestling, Open Gym, Roll Time, Grappling, Open Sparring, Live Rolling, Saturday/Sunday Roll, Weekend Roll, Lunch Roll, Morning Roll, Women's Open Mat, Ladies Roll, Women's Only, Girls Roll, Randori, Open Drilling, Flow Roll, Positional Sparring, Open Practice, Drop-In Rolling, Community Roll, All-Levels Roll.

## Signals that a session is LIKELY an open mat (include with a note)
- Any session on Saturday or Sunday that is 90+ minutes and labeled "all levels" or has no level designation
- Sessions described as "come roll," "get rounds in," "mat time available"
- Sessions with no instructor listed while other classes list instructors
- A weekend session that is longer than the gym's typical class length
- Sessions labeled "Sparring Class" or "Advanced Rolling" or "Competition Training" that appear open to all members
- Any session where the description mentions "rolling," "sparring," or "live training" as the primary activity

## What is definitely NOT an open mat
- Structured curriculum classes (Fundamentals, Basics, Technique)
- Kids/Youth classes
- Private lessons
- Yoga/Conditioning/Strength/Cardio classes
- Seminars or special events
- Belt promotions or graduation ceremonies
- Open Enrollment/Registration/Open House marketing events
- Trial classes or introductory lessons

## Instructions
- Search the ENTIRE page content thoroughly — schedules may be in tables, divs, lists, or plain text
- Extract EVERY session that IS or COULD BE an open mat
- For uncertain matches, set the class_name to what it's called on the schedule and add a note explaining why you think it might be an open mat
- Use 24-hour time format (HH:MM)
- Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday
- If the page has no schedule content at all, set schedule_page_found to false
- When in doubt, INCLUDE the session — it's better to flag a possible open mat than to miss a real one`;

const TOOL_SCHEMA = {
  name: 'report_open_mats',
  description: 'Report extracted open mat sessions from the schedule page',
  input_schema: {
    type: 'object' as const,
    properties: {
      open_mats: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            class_name: { type: 'string', description: 'Name as listed on schedule' },
            day_of_week: { type: 'integer', minimum: 0, maximum: 6 },
            start_time: { type: 'string', description: '24h format HH:MM' },
            end_time: { type: ['string', 'null'], description: '24h format HH:MM or null' },
            type: { type: 'string', enum: ['gi', 'nogi', 'both', 'unknown'] },
            recurring: { type: 'boolean' },
            specific_date: { type: ['string', 'null'] },
            drop_in_fee: {
              type: 'object',
              properties: {
                free: { type: 'boolean' },
                amount: { type: ['number', 'null'] },
                first_visit_free: { type: ['boolean', 'null'] },
                unknown: { type: 'boolean' },
              },
              required: ['free', 'unknown'],
            },
            visitor_access: { type: 'string', enum: ['open_to_all', 'contact_first', 'members_only', 'unknown'] },
            advance_contact_required: { type: ['boolean', 'null'] },
            contact_instructions: { type: ['string', 'null'] },
            coaching_present: { type: ['boolean', 'null'] },
            intensity: { type: 'string', enum: ['casual', 'moderate', 'competition', 'varies', 'unknown'] },
            beginner_friendly: { type: ['boolean', 'null'] },
            women_only: { type: 'boolean' },
            competition_focused: { type: ['boolean', 'null'] },
            uniform_restrictions: { type: ['string', 'null'] },
            notes: { type: ['string', 'null'] },
          },
          required: ['class_name', 'day_of_week', 'start_time', 'end_time', 'type', 'recurring', 'women_only'],
        },
      },
      schedule_page_found: { type: 'boolean' },
      confidence_note: { type: ['string', 'null'] },
    },
    required: ['open_mats', 'schedule_page_found'],
  },
};

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set — AI extraction disabled');
    return null;
  }
  return new Anthropic({ apiKey });
}

/**
 * Extract open mats from cleaned HTML using Claude Haiku.
 */
export async function extractWithAI(cleanedHtml: string): Promise<AIExtractionResult> {
  const empty: AIExtractionResult = {
    openMats: [],
    schedulePageFound: false,
    confidenceNote: null,
    tokensUsed: { input: 0, output: 0 },
  };

  const client = getClient();
  if (!client) return empty;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: cleanedHtml },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool' as const, name: 'report_open_mats' },
    });

    const toolUse = response.content.find((c) => c.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') return empty;

    const input = toolUse.input as {
      open_mats: AIExtractedOpenMat[];
      schedule_page_found: boolean;
      confidence_note: string | null;
    };

    return {
      openMats: input.open_mats ?? [],
      schedulePageFound: input.schedule_page_found ?? false,
      confidenceNote: input.confidence_note ?? null,
      tokensUsed: {
        input: response.usage?.input_tokens ?? 0,
        output: response.usage?.output_tokens ?? 0,
      },
    };
  } catch (err) {
    console.error('AI extraction failed:', (err as Error).message);
    return empty;
  }
}

/**
 * Extract open mats from a screenshot using Claude Haiku Vision.
 */
export async function extractWithAIVision(screenshotBuffer: Buffer): Promise<AIExtractionResult> {
  const empty: AIExtractionResult = {
    openMats: [],
    schedulePageFound: false,
    confidenceNote: null,
    tokensUsed: { input: 0, output: 0 },
    isScreenshot: true,
  };

  const client = getClient();
  if (!client) return empty;

  try {
    const base64 = screenshotBuffer.toString('base64');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: base64 },
          },
          {
            type: 'text',
            text: 'This is a screenshot of a BJJ gym website. Extract any open mat sessions visible.',
          },
        ],
      }],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool' as const, name: 'report_open_mats' },
    });

    const toolUse = response.content.find((c) => c.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') return empty;

    const input = toolUse.input as {
      open_mats: AIExtractedOpenMat[];
      schedule_page_found: boolean;
      confidence_note: string | null;
    };

    return {
      openMats: input.open_mats ?? [],
      schedulePageFound: input.schedule_page_found ?? false,
      confidenceNote: input.confidence_note ?? null,
      tokensUsed: {
        input: response.usage?.input_tokens ?? 0,
        output: response.usage?.output_tokens ?? 0,
      },
      isScreenshot: true,
    };
  } catch (err) {
    console.error('AI vision extraction failed:', (err as Error).message);
    return empty;
  }
}
