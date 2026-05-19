#!/usr/bin/env node
// Bin shim for the odb CLI. Prefers compiled dist; falls back to tsx in dev.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const compiled = path.join(here, "..", "dist", "cli", "main.js");
const source = path.join(here, "..", "src", "cli", "main.ts");

if (existsSync(compiled)) {
  await import(compiled);
} else {
  const child = spawn(
    process.execPath,
    [
      path.join(here, "..", "node_modules", "tsx", "dist", "cli.mjs"),
      source,
      ...process.argv.slice(2),
    ],
    { stdio: "inherit" },
  );
  child.on("exit", (code) => process.exit(code ?? 0));
}
