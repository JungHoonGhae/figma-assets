import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

export class NodeCache {
  private cacheDir: string;
  private nodesDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
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

  getSvg(nodeId: string): string | null {
    const filePath = this.svgFilePath(nodeId);
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, "utf-8");
  }

  setSvg(nodeId: string, svg: string): void {
    const dir = join(this.cacheDir, "icons");
    mkdirSync(dir, { recursive: true });
    writeFileSync(this.svgFilePath(nodeId), svg);
  }

  private filePath(nodeId: string): string {
    const safeName = nodeId.replace(/:/g, "-");
    return join(this.nodesDir, `${safeName}.json`);
  }

  private svgFilePath(nodeId: string): string {
    const safeName = nodeId.replace(/:/g, "-");
    return join(this.cacheDir, "icons", `${safeName}.svg`);
  }
}
