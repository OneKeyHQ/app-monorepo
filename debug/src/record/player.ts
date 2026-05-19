// Player — replay JS-layer events from an .odb directory onto a target
// session, or surface events around a timestamp for inspection.
//
// Replay semantics (see debug/docs/odb-format.md):
//   - js.eval events can be re-executed on a *target* session.
//   - native events are dry-run only (mutating real state is unsafe).
//   - network events are read-only timeline markers.
//   - ui snapshots are pure observation.
import type { Registry } from "../daemon/registry.js";
import { jsEval } from "../tools/jsEval.js";
import {
  readAllEvents,
  readManifest,
  type Layer,
  type OdbEvent,
  type OdbManifest,
} from "./format.js";

export interface ReplayParams {
  path: string;
  targetSessionId?: string;
  layers?: Layer[];
  speed?: number; // 1.0 = real time; > 1 = faster
}

export interface ReplayResult {
  replayed: number;
  skipped: number;
  errors: number;
}

export async function replay(
  registry: Registry,
  params: ReplayParams,
): Promise<ReplayResult> {
  const events = await readAllEvents(params.path);
  if (events.length === 0) return { replayed: 0, skipped: 0, errors: 0 };

  const filter = new Set<Layer>(params.layers ?? ["js"]);
  const speed = params.speed ?? 1;

  let replayed = 0;
  let skipped = 0;
  let errors = 0;

  const baseline = events[0].ts;
  const wallStart = Date.now();

  for (const ev of events) {
    if (!filter.has(ev.layer)) {
      skipped += 1;
      continue;
    }
    const elapsed = (ev.ts - baseline) / speed;
    const wait = wallStart + elapsed - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    if (ev.layer === "js" && ev.kind === "eval" && params.targetSessionId) {
      try {
        await jsEval(registry, {
          sessionId: params.targetSessionId,
          expression: ev.expression,
        });
        replayed += 1;
      } catch {
        errors += 1;
      }
    } else {
      // Native / network / ui events are dry-run; just count them.
      skipped += 1;
    }
  }
  return { replayed, skipped, errors };
}

export interface TimelineParams {
  path: string;
  t: number; // ms relative to recording start
  windowMs?: number; // default 1000 (half-window each side)
}

export interface TimelineResult {
  manifest: OdbManifest;
  events: OdbEvent[];
}

export async function timeline(
  params: TimelineParams,
): Promise<TimelineResult> {
  const manifest = await readManifest(params.path);
  const absStart = manifest.startedAt + params.t;
  const half = (params.windowMs ?? 1000) / 2;
  const all = await readAllEvents(params.path);
  const events = all.filter((e) => Math.abs(e.ts - absStart) <= half);
  return { manifest, events };
}
