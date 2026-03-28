#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { auditCommand } from "./commands/audit.js";
import { diffCommand } from "./commands/diff.js";
import { extractCommand } from "./commands/extract.js";
import { cacheCommand } from "./commands/cache.js";

const program = new Command();

program
  .name("figma-doctor")
  .description("Diagnose the gap between Figma rendering engine and browser CSS engine")
  .version("0.1.0");

program.command("init").description("Create .figma-doctor.json config file").action(initCommand);

program.command("audit <figma-url>")
  .description("Audit Figma node for CSS-incompatible properties")
  .option("--format <type>", "Output format: table or json", "table")
  .option("--severity <level>", "Filter by severity: error or warning")
  .action(auditCommand);

program.command("diff <page>")
  .description("Compare Figma design values with browser-rendered values")
  .option("--figma-url <url>", "Figma URL (instead of config)")
  .option("--page-url <url>", "Browser URL (instead of config)")
  .option("--format <type>", "Output format: table or json", "table")
  .option("--refresh", "Bypass cache", false)
  .option("--tolerance <px>", "Override size tolerance in px", parseFloat)
  .action(diffCommand);

program.command("extract <figma-url>")
  .description("Extract raw Figma values normalized to CSS units")
  .option("--format <type>", "Output format: table or json", "table")
  .option("--refresh", "Bypass cache", false)
  .action(extractCommand);

program.command("cache <action> [page]")
  .description("Manage cache (clear [page])")
  .action(cacheCommand);

program.parse();
