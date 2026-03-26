import type { FetchResult } from './types';

const TIMEOUT_MS = 10_000;
const USER_AGENT = 'BJJOpenMatFinder/1.0 (https://bjj-open-mat-finder.vercel.app)';
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 3_000;

/**
 * Stage 1: Fetch a page with timeout, retry, redirect following, and content-type validation.
 * Returns null only after all retries exhausted.
 */
export async function fetchPage(url: string): Promise<FetchResult | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Don't retry client errors (4xx) — only retry server errors (5xx)
        if (response.status >= 400 && response.status < 500) {
          return null;
        }
        console.warn(`Fetch ${url}: HTTP ${response.status}`);
        if (attempt < MAX_RETRIES) {
          await delay(RETRY_DELAY_MS);
          continue;
        }
        return null;
      }

      const contentType = response.headers.get('content-type') ?? '';
      // Accept HTML, XHTML, or empty content-type (some gyms misconfigure headers)
      const isHtml = contentType.includes('text/html')
        || contentType.includes('text/xhtml')
        || contentType.includes('application/xhtml')
        || contentType === '';

      if (!isHtml) return null;

      const html = await response.text();

      return {
        html,
        statusCode: response.status,
        finalUrl: response.url,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Fetch ${url} attempt ${attempt + 1}: ${message}`);
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS);
        continue;
      }
      return null;
    }
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
