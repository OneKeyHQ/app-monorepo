// RPC wrappers for record / replay / timeline. Validates inputs and forwards
// to the underlying recorder / player modules.
import type { Registry } from "../daemon/registry.js";
import type { Layer } from "../record/format.js";
import {
  replay,
  timeline,
  type ReplayParams,
  type ReplayResult,
  type TimelineParams,
  type TimelineResult,
} from "../record/player.js";
import {
  isRecording,
  startRecording,
  stopRecording,
} from "../record/recorder.js";

export async function recordStart(
  r: Registry,
  p: { sessionId: string; layers?: Layer[]; uiIntervalMs?: number },
): Promise<{ recordId: string; path: string }> {
  const layers: Layer[] = p.layers ?? ["js", "network", "native", "ui"];
  return await startRecording(r, {
    sessionId: p.sessionId,
    layers,
    uiIntervalMs: p.uiIntervalMs,
  });
}

export async function recordStop(
  r: Registry,
  p: { sessionId: string },
): Promise<{ path: string; eventCount: number; durationMs: number }> {
  return await stopRecording(r, p);
}

export function recordStatus(
  r: Registry,
  p: { sessionId: string },
): { recording: boolean } {
  r.get(p.sessionId);
  return { recording: isRecording(p.sessionId) };
}

export async function recordReplay(
  r: Registry,
  p: ReplayParams,
): Promise<ReplayResult> {
  return await replay(r, p);
}

export async function recordTimeline(
  _r: Registry,
  p: TimelineParams,
): Promise<TimelineResult> {
  return await timeline(p);
}
