// Device memory: the single source of truth for "how much RAM does this device
// have" and "is it memory-constrained" across the app.
//
//   getDeviceMemoryGBSync — platform-split primitive (expo-device.totalMemory on
//                           native, exact bridged RAM on desktop, and
//                           navigator.deviceMemory on web/extension)
//   isLowEndMemory        — the ONE low-memory predicate (<= LOW_END_THRESHOLD)
//   IS_LOW_END_DEVICE     — that predicate evaluated once at module load
//
// Consumers (capability profiles, DApp WebView retention, and the iOS
// cold-start-lock defer guard) all use this predicate so they agree on which
// devices are memory constrained.

import { getDeviceMemoryGBSync } from './getMemorySync';

export * from './getMemorySync';

// Memory at/below this (GB) marks a memory-constrained device. Sized to cover
// 2–3GB-class iOS devices (e.g. iPhone 7 Plus reports ~3.14GB) that suffer the
// jetsam cold-start-lock kill loop.
export const LOW_END_MEMORY_THRESHOLD_GB = 3.5;

/** The single low-memory classification used everywhere. */
export function isLowEndMemory(memoryGB: number): boolean {
  return memoryGB > 0 && memoryGB <= LOW_END_MEMORY_THRESHOLD_GB;
}

// Low-end-device flag, computed once at module load from device RAM.
//
// Intentionally derived directly from physical memory. The cold-start-lock
// guard this flag powers must work on the first boot after an upgrade without
// waiting for another capability or runtime signal.
//
// On web/desktop the value is inert: the only consumer additionally gates on
// `platformEnv.isNative`.
const memoryGB = getDeviceMemoryGBSync();

export const IS_LOW_END_DEVICE = memoryGB !== null && isLowEndMemory(memoryGB);
