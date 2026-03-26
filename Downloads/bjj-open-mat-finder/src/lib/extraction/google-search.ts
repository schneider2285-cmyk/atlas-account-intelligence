/**
 * Google search augmentation for open mat discovery.
 * When a gym's website doesn't mention open mats, we search Google
 * for "{gym name} open mat" to find info from social media, reviews, etc.
 */

import Anthropic from '@anthropic-ai/sdk';

const SEARCH_SYSTEM_PROMPT = `You are a BJJ open mat data extractor. You are given Google search result snippets about a specific BJJ gym.

Your job: determine if these search results contain evidence of open mat sessions at this gym, and extract any schedule details you can find.

## What counts as evidence of open mats
- Explicit mentions of "open mat" with day/time info
- Social media posts mentioning open mat schedules
- Review mentions like "they have open mat on Saturdays"
- Event listings for open mat sessions
- Directory listings (e.g., BJJ Open Mat Finder, OpenMat.com) with schedule data

## What to extract
- Day of week and times if available
- Gi/NoGi/Both if mentioned
- Any notes about cost, visitor policy, etc.
- If you find evidence that a gym HAS open mats but no specific schedule, still report it with your best guess at day_of_week (weekends are most common) and note the uncertainty

## Important
- Only extract data that is clearly about THIS specific gym
- If results are ambiguous or about a different gym, report nothing
- Set schedule_page_found to true if ANY result mentions this gym having open mats`;

const TOOL_SCHEMA = {
  name: 'report_open_mats',
  description: 'Report open mat sessions found in search results',
  input_schema: {
    type: 'object' as const,
    properties: {
      open_mats: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            class_name: { type: 'string', description: 'Name as found in search results' },
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
      schedule_page_found: { type: 'boolean', description: 'True if any result mentions this gym having open mats' },
      confidence_note: { type: ['string', 'null'] },
    },
    required: ['open_mats', 'schedule_page_found'],
  },
};

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

/**
 * Search Google for "{gym name} open mat" using the Custom Search API
 * or a simple web scraping approach.
 */
export async function searchGoogleForOpenMats(gymName: string): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  // If we have Google Custom Search configured, use it
  if (apiKey && searchEngineId) {
    const query = encodeURIComponent(`"${gymName}" "open mat" schedule`);
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${query}&num=5`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        console.warn(`Google Custom Search returned ${res.status}`);
        return [];
      }
      const data = await res.json();
      return (data.items || []).map((item: any) => ({
        title: item.title || '',
        snippet: item.snippet || '',
        url: item.link || '',
      }));
    } catch (err) {
      console.warn('Google Custom Search failed:', (err as Error).message);
      return [];
    }
  }

  // Fallback: use Anthropic web search tool if available (claude-sonnet with web search)
  // For now, just return empty - we'll add the Serper API as a cheap alternative
  console.log(`[GoogleSearch] No GOOGLE_SEARCH_ENGINE_ID configured, skipping search for ${gymName}`);
  return [];
}

/**
 * Use Serper.dev API (cheap Google SERP API - $50 for 50K searches)
 */
export async function searchSerperForOpenMats(gymName: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: `"${gymName}" "open mat"`,
        num: 8,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    return (data.organic || []).map((item: any) => ({
      title: item.title || '',
      snippet: item.snippet || '',
      url: item.link || '',
    }));
  } catch (err) {
    console.warn('Serper search failed:', (err as Error).message);
    return [];
  }
}

/**
 * Search for open mat info and extract structured data using Claude.
 */
export async function searchAndExtractOpenMats(gymName: string): Promise<{
  openMats: import('./types').AIExtractedOpenMat[];
  schedulePageFound: boolean;
  confidenceNote: string | null;
  tokensUsed: { input: number; output: number };
}> {
  const empty = {
    openMats: [] as import('./types').AIExtractedOpenMat[],
    schedulePageFound: false,
    confidenceNote: null,
    tokensUsed: { input: 0, output: 0 },
  };

  // Try Serper first (cheapest), then Google Custom Search
  let results = await searchSerperForOpenMats(gymName);
  if (results.length === 0) {
    results = await searchGoogleForOpenMats(gymName);
  }

  if (results.length === 0) return empty;

  // Format search results for the AI
  const searchText = results
    .map((r, i) => `[Result ${i + 1}]\nTitle: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`)
    .join('\n\n');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return empty;

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SEARCH_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Gym name: ${gymName}\n\nGoogle search results:\n\n${searchText}`,
      }],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool' as const, name: 'report_open_mats' },
    });

    const toolUse = response.content.find((c) => c.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') return empty;

    const input = toolUse.input as any;

    return {
      openMats: input.open_mats ?? [],
      schedulePageFound: input.schedule_page_found ?? false,
      confidenceNote: input.confidence_note ? `[Google Search] ${input.confidence_note}` : '[Google Search] Data from search results',
      tokensUsed: {
        input: response.usage?.input_tokens ?? 0,
        output: response.usage?.output_tokens ?? 0,
      },
    };
  } catch (err) {
    console.error('Search extraction failed:', (err as Error).message);
    return empty;
  }
}
