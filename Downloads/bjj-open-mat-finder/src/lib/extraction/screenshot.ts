/**
 * Playwright-based screenshot capture for JS-rendered and image-based schedule pages.
 * Used as fallback when HTML-based AI extraction finds no schedule content.
 *
 * NOTE: Playwright requires chromium binary. For bulk runs, use the shared browser
 * functions to avoid launching/closing per gym.
 */

let sharedBrowser: import('playwright').Browser | null = null;

/**
 * Launch a shared browser instance for bulk runs.
 * Call closeBrowser() when done.
 */
export async function launchBrowser(): Promise<void> {
  if (sharedBrowser) return;
  const { chromium } = await import('playwright');
  sharedBrowser = await chromium.launch({ headless: true });
}

/**
 * Close the shared browser instance.
 */
export async function closeBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

/**
 * Capture a full-page screenshot of a URL.
 * Uses shared browser if available, otherwise launches a temporary one.
 */
export async function captureScheduleScreenshot(url: string): Promise<Buffer | null> {
  const { chromium } = await import('playwright');
  const isTemporary = !sharedBrowser;
  const browser = sharedBrowser ?? await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 2000 },
      userAgent: 'BJJOpenMatFinder/1.0',
    });

    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout: 15_000 });

    // Scroll to trigger lazy-loaded content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    const screenshot = await page.screenshot({ fullPage: true, type: 'png' });

    await context.close();

    return Buffer.from(screenshot);
  } catch (err) {
    console.warn(`Screenshot failed for ${url}: ${(err as Error).message}`);
    return null;
  } finally {
    if (isTemporary) {
      await browser.close();
    }
  }
}
