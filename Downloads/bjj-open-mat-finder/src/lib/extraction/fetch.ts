import type { FetchResult } from './types';

const TIMEOUT_MS = 10_000;
const USER_AGENT = 'BJJOpenMatFinder/1.0 (https://bjj-open-mat-finder.vercel.app)';

/**
 * Stage 1: Fetch a page with timeout, redirect following, and content-type validation.
 * Returns null on any error (timeout, DNS, 4xx/5xx, non-HTML).
 */
export async function fetchPage(url: string): Promise<FetchResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/xhtml')) {
      return null;
    }

    const html = await response.text();

    return {
      html,
      statusCode: response.status,
      finalUrl: response.url,
    };
  } catch {
    return null;
  }
}
