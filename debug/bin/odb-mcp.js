#!/usr/bin/env node
// Bin shim for the odb-mcp stdio server. Prefers compiled dist; falls back to
// tsx in dev. Mirrors bin/odb.js but launches the MCP server entry instead.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const compiled = path.join(here, "..", "dist", "mcp", "server.js");
const source = path.join(here, "..", "src", "mcp", "server.ts");

if (existsSync(compiled)) {
  await import(compiled);
} else {
  const child = spawn(
    process.execPath,
    [path.join(here, "..", "node_modules", "tsx", "dist", "cli.mjs"), source],
    { stdio: "inherit" },
  );
  child.on("exit", (code) => process.exit(code ?? 0));
}
