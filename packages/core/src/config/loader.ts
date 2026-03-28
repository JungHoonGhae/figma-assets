import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { FigmaDoctorConfig } from "../types.js";
import { DEFAULT_TOLERANCE, DEFAULT_CACHE_DIR } from "./schema.js";

const CONFIG_FILENAME = ".figma-doctor.json";

export function loadConfig(dir: string): FigmaDoctorConfig {
  const configPath = join(dir, CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    throw new Error(
      `.figma-doctor.json not found in ${dir}. Run 'figma-doctor init' to create one.`
    );
  }

  const raw = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
  validate(raw);

  const rawDiff = raw.diff as Record<string, unknown> | undefined;
  const rawDiffTolerance = rawDiff?.tolerance as Record<string, unknown> | undefined;
  const rawCache = raw.cache as Record<string, unknown> | undefined;

  const config: FigmaDoctorConfig = {
    figma: {
      fileKey: raw.figma.fileKey,
      token: resolveEnvVar(raw.figma.token),
    },
    pages: (raw.pages as FigmaDoctorConfig["pages"]) ?? {},
    diff: {
      tolerance: { ...DEFAULT_TOLERANCE, ...(rawDiffTolerance as object | undefined) },
    },
    cache: {
      dir: (rawCache?.dir as string | undefined) ?? DEFAULT_CACHE_DIR,
    },
  };

  return config;
}

function resolveEnvVar(value: string): string {
  if (value.startsWith("$")) {
    const envName = value.slice(1);
    const envValue = process.env[envName];
    if (!envValue) {
      throw new Error(
        `Environment variable ${envName} is not set. Set it or use a literal token.`
      );
    }
    return envValue;
  }
  return value;
}

function validate(raw: unknown): asserts raw is Record<string, unknown> & { figma: { fileKey: string; token: string } } {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Config must be a JSON object");
  }
  const obj = raw as Record<string, unknown>;
  if (!obj.figma || typeof obj.figma !== "object") {
    throw new Error("Config must have a 'figma' section with fileKey and token");
  }
  const figma = obj.figma as Record<string, unknown>;
  if (typeof figma.fileKey !== "string" || typeof figma.token !== "string") {
    throw new Error("figma.fileKey and figma.token are required strings");
  }
}
