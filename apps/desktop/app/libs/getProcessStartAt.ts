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
export const getProcessStartAt = (): number => {
  try {
    const creationTime =
      typeof process.getCreationTime === 'function'
        ? process.getCreationTime()
        : null;
    return Math.round(creationTime ?? Date.now());
  } catch (_e) {
    return Math.round(Date.now());
  }
};
