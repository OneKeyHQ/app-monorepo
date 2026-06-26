// Low-end-device flag, computed once at module load from device RAM.
//
// Reuses the single shared synchronous memory primitive
// (`getDeviceMemoryGBSync`, platform-split under ../performance/deviceMemory)
// instead of reading `expo-device` directly, so device RAM has ONE source of
// truth across the app (see also ../performance/devicePerformanceTier and
// the DApp WebView alive-count tiering).
//
// We intentionally do NOT derive this from `getDevicePerformanceTier()`: that
// returns `medium` until a post-launch calibration has run and persisted, but
// the cold-start-lock guard this flag powers must work on the very first boot
// after upgrade (no calibration yet). So it must read memory synchronously
// every launch.
//
// Threshold 3.5 GB covers 2–3GB-class iOS devices (e.g. iPhone 7 Plus reports
// ~3.14 GB) that suffer the jetsam cold-start-lock kill loop. On web/desktop
// the value is inert: the only consumer additionally gates on
// `platformEnv.isNativeIOS`.
import { getDeviceMemoryGBSync } from '../performance/deviceMemory';

// Shared single source of truth for "memory-constrained device" across the app.
// Also consumed by `getMemoryTier` in ../performance/devicePerformanceTier so the
// tier system and this jetsam guard agree on which devices are low-memory.
export const LOW_END_MEMORY_THRESHOLD_GB = 3.5;

const memoryGB = getDeviceMemoryGBSync();

export const IS_LOW_END_DEVICE =
  memoryGB !== null && memoryGB > 0 && memoryGB <= LOW_END_MEMORY_THRESHOLD_GB;
