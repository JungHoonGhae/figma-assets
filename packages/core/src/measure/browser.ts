import { chromium, type Browser, type Page } from "playwright";

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

export async function openPage(url: string): Promise<Page> {
  const b = await getBrowser();
  const page = await b.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  return page;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
