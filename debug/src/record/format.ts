// .odb trace format — directory-based, append-only NDJSON.
//
// Layout:
//   trace-<id>.odb/
//     manifest.json           # version, session, started, ended, layers, eventCount
//     events.ndjson           # one JSON event per line, ordered by ts (compression="none")
//     events.ndjson.zst       # single zstd frame containing the NDJSON   (compression="zstd")
//     media/                  # ui snapshots + screenshots referenced by events
//
// Compression: when `manifest.compression === "zstd"`, events are buffered in
// memory while the recording is active and a single zstd frame is written to
// `events.ndjson.zst` at finalize time. We deliberately use a single frame
// rather than appending per-event frames because Node's zstd decompress APIs
// only decode the first frame of a concatenated stream.
//
// Backward compatibility: existing recordings written by older versions are
// always `compression="none"` with `events.ndjson`. The reader handles both
// shapes — see `readAllEvents`.
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  bestAvailableCodec,
  compressText,
  decompressToText,
} from "./codec.js";

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
// Discrete `native call` event — recorded at tool-invocation time (not
// hook-fire time) so we can re-issue the exact selector + args at replay.
// Result/error fields are best-effort: result is captured on success, error
// on failure, mirroring the runtime nativeCall semantics.
export interface OdbNativeCallEvent extends OdbEventBase {
  layer: "native";
  kind: "call";
  selector: string;
  args?: unknown[];
  result?: unknown;
  error?: unknown;
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
  | OdbNativeCallEvent
  | OdbUiEvent;

const NDJSON_NAME = "events.ndjson";
const NDJSON_ZSTD_NAME = "events.ndjson.zst";
const MANIFEST_NAME = "manifest.json";

// In-memory line buffer per .odb path while a zstd-compressed recording is
// active. Each entry is the already-serialized NDJSON line (terminator
// included). The whole buffer is compressed as a single zstd frame at
// finalize time — see the file header comment for why we don't append
// per-event frames.
const pendingByPath = new Map<string, string[]>();

export async function createOdbDir(
  p: string,
  init: OdbManifest,
): Promise<void> {
  await fs.mkdir(path.join(p, "media"), { recursive: true });
  await fs.writeFile(
    path.join(p, MANIFEST_NAME),
    JSON.stringify(init, null, 2),
  );
  if (init.compression === "zstd") {
    // Initialize the buffer; the .zst file is written on finalize.
    pendingByPath.set(p, []);
  } else {
    await fs.writeFile(path.join(p, NDJSON_NAME), "");
  }
}

export async function appendEvent(p: string, ev: OdbEvent): Promise<void> {
  const buf = pendingByPath.get(p);
  const line = JSON.stringify(ev) + "\n";
  if (buf) {
    buf.push(line);
    return;
  }
  // No in-memory buffer: this is either a "compression=none" recording or a
  // direct test write that bypassed createOdbDir. Append to plain NDJSON.
  await fs.appendFile(path.join(p, NDJSON_NAME), line);
}

export async function finalize(
  p: string,
  manifest: OdbManifest,
): Promise<void> {
  // If we have a pending zstd buffer, flush it as a single frame.
  const buf = pendingByPath.get(p);
  if (buf) {
    const text = buf.join("");
    pendingByPath.delete(p);
    if (manifest.compression === "zstd") {
      const frame = await compressText(text);
      await fs.writeFile(path.join(p, NDJSON_ZSTD_NAME), frame);
    } else {
      // Manifest was downgraded mid-recording (shouldn't normally happen,
      // but stay safe).
      await fs.writeFile(path.join(p, NDJSON_NAME), text);
    }
  }
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
  // Prefer manifest's declared compression. Fall back to extension probing
  // if the manifest is missing or the declared file is absent (legacy
  // recordings, or a recorder that crashed before finalize).
  const manifest = await readManifest(p).catch(() => null);
  const declared = manifest?.compression ?? "none";

  const zstPath = path.join(p, NDJSON_ZSTD_NAME);
  const ndjsonPath = path.join(p, NDJSON_NAME);

  const zstExists = await fileExists(zstPath);
  const ndjsonExists = await fileExists(ndjsonPath);

  let text: string;
  if (declared === "zstd" && zstExists) {
    const buf = await fs.readFile(zstPath);
    text = await decompressToText(new Uint8Array(buf));
  } else if (zstExists && !ndjsonExists) {
    // Manifest may be wrong or missing; trust the on-disk shape.
    const buf = await fs.readFile(zstPath);
    text = await decompressToText(new Uint8Array(buf));
  } else if (ndjsonExists) {
    text = await fs.readFile(ndjsonPath, "utf8");
  } else {
    // No events file present at all — treat as empty.
    text = "";
  }

  return text
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as OdbEvent);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export function eventTime(ev: OdbEvent): number {
  return ev.ts;
}

// Re-export the codec helper so callers (recorder, tests) don't have to know
// about the codec module path.
export { bestAvailableCodec };
