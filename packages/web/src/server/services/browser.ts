import type { Browser } from "playwright";

let _browser: Browser | null = null;

/**
 * Fetch a page's fully-rendered HTML using a headless Chromium browser.
 * Handles JS-rendered content, cookie walls, and bot detection.
 */
export async function fetchWithBrowser(url: string): Promise<string> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "en-GB",
  });

  try {
    const page = await context.newPage();

    // Block heavy resources we don't need
    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (["image", "media", "font", "stylesheet"].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Wait a moment for JS-rendered content to settle
    await page.waitForTimeout(2000);

    return await page.content();
  } finally {
    await context.close();
  }
}

async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.isConnected()) {
    const { chromium } = await import("playwright");
    _browser = await chromium.launch({ headless: true });
  }
  return _browser;
}

/**
 * Close the shared browser instance. Call on shutdown
 * to avoid dangling processes.
 */
export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}
