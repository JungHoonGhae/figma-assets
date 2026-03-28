import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

export class NodeCache {
  private nodesDir: string;

  constructor(cacheDir: string) {
    this.nodesDir = join(cacheDir, "nodes");
  }

  get(nodeId: string): unknown | null {
    const filePath = this.filePath(nodeId);
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf-8"));
  }

  set(nodeId: string, data: unknown): void {
    mkdirSync(this.nodesDir, { recursive: true });
    writeFileSync(this.filePath(nodeId), JSON.stringify(data, null, 2));
  }

  clear(nodeId: string): void {
    const filePath = this.filePath(nodeId);
    if (existsSync(filePath)) rmSync(filePath);
  }

  clearAll(): void {
    if (existsSync(this.nodesDir)) {
      rmSync(this.nodesDir, { recursive: true, force: true });
    }
  }

  private filePath(nodeId: string): string {
    const safeName = nodeId.replace(/:/g, "-");
    return join(this.nodesDir, `${safeName}.json`);
  }
}
