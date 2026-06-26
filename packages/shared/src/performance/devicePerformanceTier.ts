/**
 * Device Performance Tier Detection
 *
 * Classifies the device into high / medium / low tiers based on:
 *   A) Cached tier from previous launch (sync, instant)
 *   B) Runtime calibration via UI-visible time after first render (async)
 *   C) Device memory (>= 4GB high, 3.5–4GB medium, <= 3.5GB low; skipped if unavailable)
 *
 * Tier behavior (consumers decide how to use it):
 *   high   — device is fast, can do more work eagerly
 *   medium — moderate device, be selective
 *   low    — slow device, defer as much as possible
 *
 * Usage:
 *   import { getDevicePerformanceTier, calibrateDevicePerformanceTier }
 *     from '@onekeyhq/shared/src/performance/devicePerformanceTier';
 *
 *   // Synchronous — returns cached tier, or a memory-derived tier on first launch
 *   const tier = getDevicePerformanceTier();
 *
 *   // Async — call once after UI is visible to calibrate & persist
 *   await calibrateDevicePerformanceTier();
 */

import { syncStorage } from '../storage/instance/syncStorageInstance';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

import {
  getDeviceMemoryGB,
  getDeviceMemoryGBSync,
  isLowEndMemory,
} from './deviceMemory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export enum EDevicePerformanceTier {
  high = 'high',
  medium = 'medium',
  low = 'low',
}

// ---------------------------------------------------------------------------
// Thresholds (ms) — UIVisibleTime: startup → UI visible
// ---------------------------------------------------------------------------

/** Devices rendering UI in under this are considered high-perf */
const HIGH_PERF_THRESHOLD_MS = 1500;
/** Devices slower than this are considered low-perf */
const LOW_PERF_THRESHOLD_MS = 3000;

// ---------------------------------------------------------------------------
// Thresholds (GB) — Device total physical memory
// ---------------------------------------------------------------------------

const HIGH_MEM_THRESHOLD_GB = 4;

// ---------------------------------------------------------------------------
// Module-level cache (survives across calls within the same JS session)
// ---------------------------------------------------------------------------

let cachedTier: EDevicePerformanceTier | undefined;

// ---------------------------------------------------------------------------
// Tier ordering (for combining multiple signals)
// ---------------------------------------------------------------------------

const TIER_RANK: Record<EDevicePerformanceTier, number> = {
  [EDevicePerformanceTier.low]: 0,
  [EDevicePerformanceTier.medium]: 1,
  [EDevicePerformanceTier.high]: 2,
};

function lowerTier(
  a: EDevicePerformanceTier,
  b: EDevicePerformanceTier,
): EDevicePerformanceTier {
  return TIER_RANK[a] <= TIER_RANK[b] ? a : b;
}

function getMemoryTier(memoryGB: number): EDevicePerformanceTier {
  if (memoryGB >= HIGH_MEM_THRESHOLD_GB) {
    return EDevicePerformanceTier.high;
  }
  // Shares the single low-memory predicate so a device the cold-start guard
  // treats as low-end (e.g. iPhone 7 Plus ~3.14GB) also lands in the `low` tier
  // and is NOT pushed through the heavier `medium` preload queue.
  if (isLowEndMemory(memoryGB)) {
    return EDevicePerformanceTier.low;
  }
  return EDevicePerformanceTier.medium;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the device performance tier **synchronously**.
 *
 * - Reads from in-memory cache first (fastest)
 * - Falls back to MMKV sync storage (persisted from previous launch)
 * - On first-ever launch, derives the tier synchronously from device memory
 *   (falls back to `medium` only when memory is unavailable)
 *
 * Safe to call at any point, including during component render.
 */
export function getDevicePerformanceTier(): EDevicePerformanceTier {
  if (cachedTier) {
    return cachedTier;
  }

  const stored = syncStorage.getString(
    EAppSyncStorageKeys.onekey_device_performance_tier,
  );

  if (
    stored === EDevicePerformanceTier.high ||
    stored === EDevicePerformanceTier.medium ||
    stored === EDevicePerformanceTier.low
  ) {
    cachedTier = stored;
    return cachedTier;
  }

  // First launch (fresh install / cleared cache) — no calibrated tier yet.
  // Derive a tier synchronously from device memory so low-end devices are not
  // forced through the heavier `medium` preload queue on their very first boot.
  // The async runtime calibration still refines and persists this for next launch.
  const memoryGB = getDeviceMemoryGBSync();
  cachedTier =
    memoryGB !== null ? getMemoryTier(memoryGB) : EDevicePerformanceTier.medium;
  return cachedTier;
}

/**
 * Calibrate the tier using the actual UI-visible time from
 * `LaunchOptionsManager`, then persist to storage for next launch.
 *
 * Call this **once** after the splash screen has dismissed (UI visible).
 * The result takes effect on the *next* app launch.
 */
export async function calibrateDevicePerformanceTier(): Promise<EDevicePerformanceTier> {
  const { default: LaunchOptionsManager } =
    await import('../modules/LaunchOptionsManager');

  const uiVisibleTime = await LaunchOptionsManager.getUIVisibleTime();

  // Tier from startup speed
  let timeTier: EDevicePerformanceTier;
  if (uiVisibleTime > 0 && uiVisibleTime < HIGH_PERF_THRESHOLD_MS) {
    timeTier = EDevicePerformanceTier.high;
  } else if (uiVisibleTime > 0 && uiVisibleTime > LOW_PERF_THRESHOLD_MS) {
    timeTier = EDevicePerformanceTier.low;
  } else {
    timeTier = EDevicePerformanceTier.medium;
  }

  // Tier from device memory (skip if unavailable)
  const memoryGB = await getDeviceMemoryGB();
  let memoryTier: EDevicePerformanceTier | null = null;
  if (memoryGB !== null) {
    memoryTier = getMemoryTier(memoryGB);
  }

  // Combine: take the lower (more conservative) of the two signals
  const tier = memoryTier !== null ? lowerTier(timeTier, memoryTier) : timeTier;

  // Persist for next launch
  cachedTier = tier;
  syncStorage.set(EAppSyncStorageKeys.onekey_device_performance_tier, tier);

  return tier;
}

/**
 * Force-set the tier (useful for dev settings / testing).
 */
export function setDevicePerformanceTier(tier: EDevicePerformanceTier): void {
  cachedTier = tier;
  syncStorage.set(EAppSyncStorageKeys.onekey_device_performance_tier, tier);
}

/**
 * Reset cached tier (useful for testing or after app data clear).
 */
export function resetDevicePerformanceTier(): void {
  cachedTier = undefined;
  syncStorage.delete(EAppSyncStorageKeys.onekey_device_performance_tier);
}
