// Player — replay JS-layer events from an .odb directory onto a target
// session, or surface events around a timestamp for inspection.
//
// Replay semantics (see debug/docs/odb-format.md):
//   - js.eval events can be re-executed on a *target* session.
//   - native `call` events can be re-issued on a target session when
//     `--apply` is set AND a matching confirmToken is provided (§7 safety
//     gate — native re-execution is destructive). Without `--apply` the
//     native-call events are enumerated dry-run.
//   - native enter/leave/log events are observational; never re-fired
//     (would double-instrument the target).
//   - network events are read-only timeline markers.
//   - ui snapshots are pure observation.
import { createHash } from "node:crypto";

import { FridaAdapter } from "../adapters/frida.js";
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
  apply?: boolean; // default false (dry-run)
  confirmToken?: string; // required when apply=true AND layers includes native
}

export interface ReplayResult {
  replayed: number;
  skipped: number;
  errors: number;
}

// Deterministic confirm token derived from {path, target, layers}. Same
// inputs always produce the same token — the caller is expected to fetch
// it via `replay.token`, eyeball the plan, and pass it back on the
// destructive `replay --apply` call to acknowledge that they've reviewed
// the side-effect surface.
export function replayConfirmToken(params: {
  path: string;
  targetSessionId?: string;
  layers?: ReplayParams["layers"];
}): string {
  const data = JSON.stringify({
    path: params.path,
    targetSessionId: params.targetSessionId,
    layers: (params.layers ?? []).slice().sort(),
  });
  return "rct-" + createHash("sha256").update(data).digest("hex").slice(0, 16);
}

export async function replay(
  registry: Registry,
  params: ReplayParams,
): Promise<ReplayResult> {
  const events = await readAllEvents(params.path);
  if (events.length === 0) return { replayed: 0, skipped: 0, errors: 0 };

  const filter = new Set<Layer>(params.layers ?? ["js"]);
  const speed = params.speed ?? 1;
  const apply = !!params.apply;

  // §7 safety gate: refuse to apply native-layer events without a matching
  // token. The token is deterministic so the caller can pre-compute it via
  // `replay.token` and pass it back here as an explicit acknowledgement.
  if (apply && filter.has("native")) {
    const expected = replayConfirmToken({
      path: params.path,
      targetSessionId: params.targetSessionId,
      layers: params.layers,
    });
    if (params.confirmToken !== expected) {
      throw new Error(
        `replay --apply with layer=native requires confirmToken=${expected}; ` +
          `pass it explicitly to acknowledge potential state mutation`,
      );
    }
  }

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

    try {
      if (ev.layer === "js" && ev.kind === "eval" && params.targetSessionId) {
        await jsEval(registry, {
          sessionId: params.targetSessionId,
          expression: ev.expression,
        });
        replayed += 1;
      } else if (
        ev.layer === "native" &&
        ev.kind === "call" &&
        params.targetSessionId
      ) {
        if (!apply) {
          // Dry-run: don't touch the device. Counted as skipped so the
          // caller can still see the plan via `replayed` (which stays 0
          // for native unless --apply).
          skipped += 1;
        } else {
          const s = registry.get(params.targetSessionId);
          const f = s.adapters.get("frida");
          if (!(f instanceof FridaAdapter) || !f.isConnected()) {
            errors += 1;
          } else {
            await f.call(ev.selector, ev.args ?? []);
            replayed += 1;
          }
        }
      } else {
        // Native enter/leave/log, network markers, ui snapshots — all
        // observation-only.
        skipped += 1;
      }
    } catch {
      errors += 1;
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
