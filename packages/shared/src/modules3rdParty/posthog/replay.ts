import type { IInitSessionReplayOptions } from './replayTypes';

// Web and extension: Session Replay is not shipped yet. Native and desktop
// resolve replay.native.ts / replay.desktop.ts instead.
export async function initSessionReplay(
  _options: IInitSessionReplayOptions,
): Promise<void> {
  // Intentionally empty.
}
