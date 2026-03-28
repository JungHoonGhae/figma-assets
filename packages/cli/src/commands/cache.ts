import { NodeCache, loadConfig } from "@figma-doctor/core";

export function cacheCommand(action: string, pageName?: string): void {
  if (action !== "clear") { console.error(`Unknown: ${action}. Use "clear".`); process.exit(1); }

  let cacheDir = ".figma-doctor/cache";
  try { const config = loadConfig(process.cwd()); cacheDir = config.cache?.dir ?? cacheDir; } catch {}

  const cache = new NodeCache(cacheDir);

  if (pageName) {
    try {
      const config = loadConfig(process.cwd());
      const page = config.pages[pageName];
      if (page) { cache.clear(page.figmaNodeId); console.log(`✓ Cleared cache for "${pageName}"`); }
      else { console.error(`Page "${pageName}" not found.`); process.exit(1); }
    } catch { console.error("Cannot clear by page name without config."); process.exit(1); }
  } else {
    cache.clearAll();
    console.log("✓ Cleared all cache");
  }
}
