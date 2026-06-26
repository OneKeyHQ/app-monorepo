// Epoch ms when the Electron MAIN process was spawned by the OS — the true
// cold-start anchor (covers main-process init + window creation, before the
// renderer document even loads), analogous to the native side's
// ReactNativeDeviceUtils.getStartupTime().
//
// `process.getCreationTime()` returns the number of milliseconds since the Unix
// epoch (same base as `Date.now()`, NOT a monotonic clock), or null when the
// platform can't report it. We round to an integer and fall back to `Date.now()`
// so callers always get a valid epoch-ms number — the fallback is still earlier
// than UI-visible, so the derived duration stays sane.
//
// The result is cached at module scope so every window and every subsequent
// GET_PLATFORM_INFO IPC shares one anchor. This matters for the `Date.now()`
// fallback path (when `getCreationTime` is unavailable): without caching, a
// recovery window opening seconds after the main window would re-sample a
// *later* `Date.now()`, making its anchor newer than `$$onekeyJsReadyAt` and
// silently clamping the measured cold-start duration to 0. The production path
// (`getCreationTime` returns a fixed OS timestamp) is unaffected either way.
let cachedProcessStartAt: number | undefined;

export const getProcessStartAt = (): number => {
  if (cachedProcessStartAt !== undefined) {
    return cachedProcessStartAt;
  }
  try {
    const creationTime =
      typeof process.getCreationTime === 'function'
        ? process.getCreationTime()
        : null;
    cachedProcessStartAt = Math.round(creationTime ?? Date.now());
  } catch (_e) {
    cachedProcessStartAt = Math.round(Date.now());
  }
  return cachedProcessStartAt;
};
