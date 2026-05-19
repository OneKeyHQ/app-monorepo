// .odb trace format — directory-based, append-only NDJSON.
//
// Layout:
//   trace-<id>.odb/
//     manifest.json           # version, session, started, ended, layers, eventCount
//     events.ndjson           # one JSON event per line, ordered by ts
//     media/                  # ui snapshots + screenshots referenced by events
//
// Compression is reserved (manifest.compression === "zstd") but the current
// writer always uses plain NDJSON since we explicitly avoid adding new deps
// for MVP. See debug/docs/odb-format.md for the full spec.
import { promises as fs } from "node:fs";
import path from "node:path";

export type Layer = "js" | "network" | "native" | "ui";

export interface OdbManifest {
  version: 1;
  recordId: string;
  sessionId: string;
  platform: string;
  appBundle: string;
  layers: Layer[];
  startedAt: number;
  endedAt: number | null;
  eventCount: number;
  compression: "none" | "zstd";
}

export interface OdbEventBase {
  ts: number; // unix ms
  layer: Layer;
  kind: string;
}

export interface OdbJsConsoleEvent extends OdbEventBase {
  layer: "js";
  kind: "console";
  type: string;
  args: unknown[];
}
export interface OdbJsEvalEvent extends OdbEventBase {
  layer: "js";
  kind: "eval";
  expression: string;
  result?: { value?: unknown; type?: string };
  error?: unknown;
}
export interface OdbNetworkEvent extends OdbEventBase {
  layer: "network";
  kind: "request" | "response" | "failure";
  requestId: string;
  url?: string;
  method?: string;
  status?: number;
  mimeType?: string;
  errorText?: string;
}
export interface OdbNativeEvent extends OdbEventBase {
  layer: "native";
  kind: "enter" | "leave" | "log";
  hookId: number;
  method: string;
  retval?: string;
}
export interface OdbUiEvent extends OdbEventBase {
  layer: "ui";
  kind: "snapshot";
  mediaPath: string; // relative to .odb root
}

export type OdbEvent =
  | OdbJsConsoleEvent
  | OdbJsEvalEvent
  | OdbNetworkEvent
  | OdbNativeEvent
  | OdbUiEvent;

const NDJSON_NAME = "events.ndjson";
const MANIFEST_NAME = "manifest.json";

export async function createOdbDir(
  p: string,
  init: OdbManifest,
): Promise<void> {
  await fs.mkdir(path.join(p, "media"), { recursive: true });
  await fs.writeFile(
    path.join(p, MANIFEST_NAME),
    JSON.stringify(init, null, 2),
  );
  await fs.writeFile(path.join(p, NDJSON_NAME), "");
}

export async function appendEvent(p: string, ev: OdbEvent): Promise<void> {
  await fs.appendFile(path.join(p, NDJSON_NAME), JSON.stringify(ev) + "\n");
}

export async function finalize(
  p: string,
  manifest: OdbManifest,
): Promise<void> {
  await fs.writeFile(
    path.join(p, MANIFEST_NAME),
    JSON.stringify(manifest, null, 2),
  );
}

export async function readManifest(p: string): Promise<OdbManifest> {
  const raw = await fs.readFile(path.join(p, MANIFEST_NAME), "utf8");
  return JSON.parse(raw) as OdbManifest;
}

export async function readAllEvents(p: string): Promise<OdbEvent[]> {
  const raw = await fs.readFile(path.join(p, NDJSON_NAME), "utf8");
  return raw
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as OdbEvent);
}

export function eventTime(ev: OdbEvent): number {
  return ev.ts;
}
