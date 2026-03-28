import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

const CONFIG_FILENAME = ".figma-doctor.json";

export async function initCommand(): Promise<void> {
  const configPath = join(process.cwd(), CONFIG_FILENAME);
  if (existsSync(configPath)) {
    console.log(`${CONFIG_FILENAME} already exists.`);
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve));

  console.log("figma-doctor init\n");
  const fileKey = await ask("Figma file key: ");
  const tokenSource = await ask("Figma token (or $ENV_VAR): ");
  const pageName = await ask("First page name: ");
  const nodeId = await ask(`Figma node ID for "${pageName}": `);
  const pageUrl = await ask(`Local URL for "${pageName}": `);
  rl.close();

  const config = {
    figma: { fileKey, token: tokenSource },
    pages: { [pageName]: { figmaNodeId: nodeId, url: pageUrl } },
    diff: { tolerance: { size: 1, color: 1.0, fontSize: 0, lineHeight: 0.5 } },
    cache: { dir: ".figma-doctor/cache" },
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log(`\n✓ Created ${CONFIG_FILENAME}`);
}
