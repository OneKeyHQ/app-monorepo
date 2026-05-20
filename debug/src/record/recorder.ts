// Recorder — subscribes to CDP/Frida/UI sources and streams them into an
// .odb directory as NDJSON events. Each layer drains an existing buffer at a
// fixed cadence so the recorder doesn't have to install its own listeners or
// race with the live tools.
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { getBuffers } from "../adapters/cdpEvents.js";
import { FridaAdapter, type FridaEvent } from "../adapters/frida.js";
import type { Registry } from "../daemon/registry.js";
import { screenshot } from "../tools/screenshot.js";
import { uiTree } from "../tools/uiTree.js";
import { bestAvailableCodec } from "./codec.js";
import {
  appendEvent,
  createOdbDir,
  finalize,
  type Layer,
  type OdbEvent,
  type OdbManifest,
} from "./format.js";

const DEFAULT_TRACE_DIR = path.join(homedir(), ".onekey-debug", "records");

// Override the destination root for tests.
let traceDir = DEFAULT_TRACE_DIR;
export function setRecordDir(p: string): void {
  traceDir = p;
}
export function getRecordDir(): string {
  return traceDir;
}

// setInterval's return type varies between the DOM lib (number) and @types/node
// (NodeJS.Timeout). Using `ReturnType<typeof setInterval>` sidesteps that
// without forcing a dom-lib import.
type IntervalHandle = ReturnType<typeof setInterval>;

interface ActiveRecording {
  manifest: OdbManifest;
  dir: string;
  uiInterval: IntervalHandle | null;
  nativePoll: IntervalHandle | null;
  cdpPoll: IntervalHandle | null;
  consoleCursor: number;
  networkCursor: number;
  // Track which network requestIds we've already flushed each phase for so we
  // can emit response/failure events as soon as they materialize on existing
  // entries (CDP responseReceived/loadingFinished arrive after the initial
  // requestWillBeSent).
  emittedResponse: Set<string>;
  emittedFailure: Set<string>;
}

const activeBySession = new Map<string, ActiveRecording>();

export async function startRecording(
  registry: Registry,
  params: { sessionId: string; layers: Layer[]; uiIntervalMs?: number },
): Promise<{ recordId: string; path: string }> {
  const s = registry.get(params.sessionId);
  if (activeBySession.has(params.sessionId)) {
    throw new Error(`session ${params.sessionId} already recording`);
  }

  const recordId = `R-${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
  const dir = path.join(traceDir, `${recordId}.odb`);

  const manifest: OdbManifest = {
    version: 1,
    recordId,
    sessionId: s.id,
    platform: s.platform,
    appBundle: s.appBundle,
    layers: params.layers,
    startedAt: Date.now(),
    endedAt: null,
    eventCount: 0,
    compression: await bestAvailableCodec(),
  };
  await createOdbDir(dir, manifest);

  const active: ActiveRecording = {
    manifest,
    dir,
    uiInterval: null,
    nativePoll: null,
    cdpPoll: null,
    consoleCursor: 0,
    networkCursor: 0,
    emittedResponse: new Set(),
    emittedFailure: new Set(),
  };
  activeBySession.set(params.sessionId, active);

  // js console + network — poll the existing CDP ring buffers every 500ms.
  // getBuffers may return undefined if CDP hasn't been attached yet; in that
  // case we simply wait for the next tick.
  if (params.layers.includes("js") || params.layers.includes("network")) {
    const tick = async (): Promise<void> => {
      const buf = getBuffers(s.id);
      if (!buf) return;

      if (params.layers.includes("js")) {
        const slice = buf.console.slice(active.consoleCursor);
        for (const e of slice) {
          await appendEvent(dir, {
            ts: e.ts,
            layer: "js",
            kind: "console",
            type: e.type,
            args: e.args,
          });
          manifest.eventCount += 1;
        }
        active.consoleCursor = buf.console.length;
      }

      if (params.layers.includes("network")) {
        const all = [...buf.network.values()];
        // Newly seen requests — emit a request event each.
        const fresh = all.slice(active.networkCursor);
        for (const e of fresh) {
          await appendEvent(dir, {
            ts: e.startedAt,
            layer: "network",
            kind: "request",
            requestId: e.requestId,
            url: e.url,
            method: e.method,
          });
          manifest.eventCount += 1;
        }
        active.networkCursor = all.length;
        // Re-scan every known request for newly-arrived response/failure
        // info — CDP can resolve these after the initial requestWillBeSent.
        for (const e of all) {
          if (
            e.status !== undefined &&
            e.endedAt !== undefined &&
            !active.emittedResponse.has(e.requestId)
          ) {
            await appendEvent(dir, {
              ts: e.endedAt,
              layer: "network",
              kind: "response",
              requestId: e.requestId,
              status: e.status,
              mimeType: e.mimeType,
            });
            manifest.eventCount += 1;
            active.emittedResponse.add(e.requestId);
          }
          if (e.failedReason && !active.emittedFailure.has(e.requestId)) {
            await appendEvent(dir, {
              ts: e.endedAt ?? Date.now(),
              layer: "network",
              kind: "failure",
              requestId: e.requestId,
              errorText: e.failedReason,
            });
            manifest.eventCount += 1;
            active.emittedFailure.add(e.requestId);
          }
        }
      }
    };
    active.cdpPoll = setInterval(() => {
      void tick();
    }, 500);
  }

  // native — drain FridaAdapter ring buffer every 500ms.
  if (params.layers.includes("native")) {
    const frida = s.adapters.get("frida");
    if (frida instanceof FridaAdapter) {
      active.nativePoll = setInterval(() => {
        const evs = frida.drainEvents(200);
        if (evs.length === 0) return;
        void (async () => {
          for (const e of evs as FridaEvent[]) {
            await appendEvent(dir, {
              ts: e.ts,
              layer: "native",
              kind: e.kind,
              hookId: e.id,
              method: e.method,
              retval: e.retval,
            });
            manifest.eventCount += 1;
          }
        })();
      }, 500);
    }
  }

  // ui — periodic snapshot (uiTree JSON + screenshot PNG copy).
  if (params.layers.includes("ui")) {
    const interval = Math.max(500, params.uiIntervalMs ?? 2_000);
    const snap = async (): Promise<void> => {
      try {
        const tree = await uiTree(registry, { sessionId: s.id });
        const shot = await screenshot(registry, { sessionId: s.id });
        const target = path.join(dir, "media", path.basename(shot.path));
        try {
          await fs.copyFile(shot.path, target);
        } catch {
          /* best-effort */
        }
        const treeFile = path
          .basename(target)
          .replace(/\.png$/, ".tree.json");
        await fs.writeFile(
          path.join(dir, "media", treeFile),
          JSON.stringify(tree, null, 2),
        );
        await appendEvent(dir, {
          ts: Date.now(),
          layer: "ui",
          kind: "snapshot",
          mediaPath: `media/${treeFile}`,
        });
        manifest.eventCount += 1;
      } catch {
        // best-effort; missing screenshots/UI mid-recording shouldn't kill it.
      }
    };
    active.uiInterval = setInterval(() => {
      void snap();
    }, interval);
    // Fire one immediately so even very short recordings have a baseline.
    void snap();
  }

  return { recordId, path: dir };
}

export async function stopRecording(
  registry: Registry,
  params: { sessionId: string },
): Promise<{ path: string; eventCount: number; durationMs: number }> {
  registry.get(params.sessionId);
  const a = activeBySession.get(params.sessionId);
  if (!a) throw new Error(`session ${params.sessionId} is not recording`);

  for (const t of [a.uiInterval, a.nativePoll, a.cdpPoll]) {
    if (t) clearInterval(t);
  }
  a.manifest.endedAt = Date.now();
  await finalize(a.dir, a.manifest);
  activeBySession.delete(params.sessionId);

  return {
    path: a.dir,
    eventCount: a.manifest.eventCount,
    durationMs: a.manifest.endedAt - a.manifest.startedAt,
  };
}

export function isRecording(sessionId: string): boolean {
  return activeBySession.has(sessionId);
}

// True when the session has an active recording AND that recording was
// configured to capture events on `layer`. Used by tools that want to
// stream extra events (e.g. native.call) into the .odb out-of-band from
// the timer-driven pollers.
export function isRecordingLayer(sessionId: string, layer: Layer): boolean {
  const a = activeBySession.get(sessionId);
  return !!a && a.manifest.layers.includes(layer);
}

// Append an event from outside the recorder's own polling loops. Silently
// no-ops when the session isn't recording or the event's layer isn't part
// of the active manifest — callers don't need to gate themselves.
export async function recordExternalEvent(
  sessionId: string,
  ev: OdbEvent,
): Promise<void> {
  const a = activeBySession.get(sessionId);
  if (!a) return;
  if (!a.manifest.layers.includes(ev.layer)) return;
  await appendEvent(a.dir, ev);
  a.manifest.eventCount += 1;
}

// Test helper — clear active recordings and their timers between tests.
export function _clearActive(): void {
  for (const a of activeBySession.values()) {
    for (const t of [a.uiInterval, a.nativePoll, a.cdpPoll]) {
      if (t) clearInterval(t);
    }
  }
  activeBySession.clear();
}
