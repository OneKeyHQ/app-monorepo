/**
 * Segment manifest (Phase 2)
 *
 * Holds the segment manifest data and provides lookup methods.
 * The manifest is embedded into the eager entry at build time by the
 * Metro serializer as a JSON literal inside a `__SEGMENT_MANIFEST__` global.
 *
 * At runtime, calling `getSegmentManifest()` reads and caches this global.
 */

import { getRuntimeKind } from './runtimeInfo';

import type {
  IRuntimeKind,
  ISegmentManifest,
  ISegmentManifestEntry,
  ISegmentManifestRecord,
  ISegmentManifestVariantRecord,
  ISegmentRuntime,
} from './types';

type IManifestGlobal = typeof globalThis & {
  __SEGMENT_MANIFEST__?: ISegmentManifest;
};

let cachedManifest: ISegmentManifest | undefined;

export function getSegmentManifest(): ISegmentManifest {
  if (cachedManifest) {
    return cachedManifest;
  }
  const manifest = (globalThis as IManifestGlobal).__SEGMENT_MANIFEST__;
  if (!manifest) {
    // No manifest = no segments (e.g. dev mode or non-split build)
    cachedManifest = { segments: {} };
    return cachedManifest;
  }
  cachedManifest = manifest;
  return cachedManifest;
}

function isSegmentManifestVariantRecord(
  record: ISegmentManifestRecord,
): record is ISegmentManifestVariantRecord {
  return typeof record === 'object' && record !== null && 'variants' in record;
}

export function getSegmentEntry(
  segmentKey: string,
  runtimeKind: IRuntimeKind = getRuntimeKind(),
): ISegmentManifestEntry | undefined {
  const record = getSegmentManifest().segments[segmentKey];
  if (!record) {
    return undefined;
  }
  if (!isSegmentManifestVariantRecord(record)) {
    return record;
  }

  return record.variants[runtimeKind] || record.variants.shared;
}

export function getSegmentCount(): number {
  return Object.keys(getSegmentManifest().segments).length;
}

/**
 * Returns true if the given segment is allowed to load in the given runtime.
 * - 'shared' segments can load in any runtime
 * - 'main' segments can only load in the main runtime
 * - 'background' segments can only load in the background runtime
 */
export function isSegmentAllowedInRuntime(
  segmentRuntime: ISegmentRuntime,
  currentRuntime: 'main' | 'background',
): boolean {
  if (segmentRuntime === 'shared') return true;
  return segmentRuntime === currentRuntime;
}
