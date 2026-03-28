import type { FigmaNode, DOMElement } from "../types.js";
import { openPage, closeBrowser } from "./browser.js";
import { buildSelectors, textXPath, type SelectorEntry } from "./matcher.js";
import { getComputedStyles } from "./styles.js";

export interface MeasureOptions {
  url: string;
  nodes: FigmaNode[];
}

export interface MeasureResult {
  elements: DOMElement[];
  matched: number;
  total: number;
}

export async function measure(options: MeasureOptions): Promise<MeasureResult> {
  const selectors = buildSelectors(options.nodes);
  const page = await openPage(options.url);
  const elements: DOMElement[] = [];

  try {
    for (const entry of selectors) {
      try {
        const domElement = await measureEntry(page, entry);
        if (domElement) elements.push(domElement);
      } catch { /* Element not found — skip */ }
    }
  } finally {
    await page.close();
    // Browser is kept alive for reuse across multiple measure() calls.
    // Callers must invoke closeBrowser() when fully done.
  }

  return { elements, matched: elements.length, total: selectors.length };
}

async function measureEntry(
  page: import("playwright").Page,
  entry: SelectorEntry
): Promise<DOMElement | null> {
  if (entry.strategy === "text" && entry.textContent) {
    const xpath = textXPath(entry.textContent);
    const locator = page.locator(`xpath=${xpath}`).first();
    const count = await locator.count();
    if (count === 0) return null;

    const selector = await locator.evaluate((el: Element) => {
      const path: string[] = [];
      let current: Element | null = el;
      while (current && current !== document.body) {
        let seg = current.tagName.toLowerCase();
        if (current.id) { seg = `#${current.id}`; path.unshift(seg); break; }
        const parent: Element | null = current.parentElement;
        if (parent) {
          const currentTag = current.tagName;
          const siblings = Array.from(parent.children).filter((c: Element) => c.tagName === currentTag);
          if (siblings.length > 1) { const index = siblings.indexOf(current) + 1; seg += `:nth-of-type(${index})`; }
        }
        path.unshift(seg);
        current = current.parentElement;
      }
      return path.join(" > ");
    });

    const styles = await getComputedStyles(page, selector);
    return { selector, textContent: entry.textContent, computedStyles: styles, matchedFigmaNodeId: entry.nodeId };
  }
  return null; // structural matching — skip for MVP
}

export { closeBrowser } from "./browser.js";
