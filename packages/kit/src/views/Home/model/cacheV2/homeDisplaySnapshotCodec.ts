import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import {
  decodeHomeStoreSnapshot,
  encodeHomeStoreSnapshot,
} from '../store/homeStoreSnapshotCodec';
import { HOME_STORE_SOURCE_IDS } from '../store/homeStoreTypes';

import {
  getHomeDisplaySnapshotChunkKey,
  getHomeDisplaySnapshotManifestKey,
} from './homeDisplaySnapshotKeys';
import {
  HOME_DISPLAY_SNAPSHOT_MAX_CHUNK_BYTES,
  HOME_DISPLAY_SNAPSHOT_MAX_CRITICAL_BYTES,
  HOME_DISPLAY_SNAPSHOT_MAX_ROUTES,
  HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION,
} from './homeDisplaySnapshotTypes';

import type {
  IHomeDisplaySnapshotChunkDescriptor,
  IHomeDisplaySnapshotChunkId,
  IHomeDisplaySnapshotCritical,
  IHomeDisplaySnapshotManifest,
  IHomeDisplaySnapshotRoute,
  IHomeDisplaySnapshotRouteIndex,
} from './homeDisplaySnapshotTypes';
import type {
  IHomeNavigationSemanticModel,
  IHomeShellSemanticModel,
  IHomeTabId,
} from '../semantic/homeSemanticTypes';
import type { IHomeCachedSourceRecord } from '../store/homeStoreTypes';

function getByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isHomeTabId(value: unknown): value is IHomeTabId {
  return (
    value === 'portfolio' ||
    value === 'perps' ||
    value === 'defi' ||
    value === 'nft' ||
    value === 'history'
  );
}

function isHomeDisplaySnapshotChunkId(
  value: unknown,
): value is IHomeDisplaySnapshotChunkId {
  return (
    value === 'critical' ||
    HOME_STORE_SOURCE_IDS.some((sourceId) => sourceId === value)
  );
}

function isHomeShellSemanticModel(
  value: unknown,
): value is IHomeShellSemanticModel {
  if (!isObject(value)) {
    return false;
  }
  return (
    value.kind === 'loading' ||
    value.kind === 'backupRequired' ||
    value.kind === 'missingNetworkAccount' ||
    (value.kind === 'portfolio' && isObject(value.presentation))
  );
}

function isHomeNavigationSemanticModel(
  value: unknown,
): value is IHomeNavigationSemanticModel {
  if (!isObject(value)) {
    return false;
  }
  if (value.kind === 'hidden') {
    return true;
  }
  return (
    value.kind === 'ready' &&
    Array.isArray(value.tabs) &&
    value.tabs.length > 0 &&
    value.tabs.every(isHomeTabId) &&
    isHomeTabId(value.selectedTabId)
  );
}

export function projectHomeDisplaySnapshotShell(
  shell: IHomeShellSemanticModel,
): IHomeShellSemanticModel | undefined {
  if (shell.kind !== 'portfolio') {
    return undefined;
  }
  const presentation = shell.presentation;
  if (presentation.kind === 'funded') {
    return {
      kind: 'portfolio',
      presentation: {
        ...presentation,
        header: {
          ...presentation.header,
          authority: 'confirmedCache',
        },
        freshness: 'confirmedCache',
        refresh: 'refreshing',
      },
    };
  }
  if (presentation.kind === 'zero') {
    return {
      kind: 'portfolio',
      presentation: {
        ...presentation,
        freshness: 'confirmedCache',
        refresh: 'refreshing',
      },
    };
  }
  return undefined;
}

export function projectHomeDisplaySnapshotNavigation(
  navigation: IHomeNavigationSemanticModel,
): IHomeNavigationSemanticModel | undefined {
  if (navigation.kind !== 'ready') {
    return undefined;
  }
  if (navigation.destinations) {
    return {
      ...navigation,
      freshness: 'confirmedCache',
      refresh: 'refreshing',
    };
  }
  return navigation;
}

export function encodeHomeDisplaySnapshotCritical(
  value: IHomeDisplaySnapshotCritical,
): string | undefined {
  const encoded = stringUtils.stableStringify(value);
  return getByteLength(encoded) <= HOME_DISPLAY_SNAPSHOT_MAX_CRITICAL_BYTES
    ? encoded
    : undefined;
}

export function decodeHomeDisplaySnapshotCritical({
  expectedOwnerScopeKey,
  now,
  raw,
}: {
  expectedOwnerScopeKey: string;
  now: number;
  raw: string | undefined;
}): IHomeDisplaySnapshotCritical | undefined {
  if (!raw || getByteLength(raw) > HOME_DISPLAY_SNAPSHOT_MAX_CRITICAL_BYTES) {
    return undefined;
  }
  try {
    const value = JSON.parse(raw) as Partial<IHomeDisplaySnapshotCritical>;
    if (
      value.schemaVersion !== HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION ||
      value.ownerScopeKey !== expectedOwnerScopeKey ||
      !Number.isSafeInteger(value.createdAt) ||
      !Number.isSafeInteger(value.expiresAt) ||
      Number(value.expiresAt) <= now ||
      (value.shell !== undefined && !isHomeShellSemanticModel(value.shell)) ||
      (value.navigation !== undefined &&
        !isHomeNavigationSemanticModel(value.navigation)) ||
      (value.selectedTabPreference !== undefined &&
        !isHomeTabId(value.selectedTabPreference))
    ) {
      return undefined;
    }
    return value as IHomeDisplaySnapshotCritical;
  } catch {
    return undefined;
  }
}

export function encodeHomeDisplaySnapshotSourceChunk({
  key,
  ownerScopeKey,
  record,
  createdAt,
  expiresAt,
}: {
  key: string;
  ownerScopeKey: string;
  record: IHomeCachedSourceRecord;
  createdAt: number;
  expiresAt: number;
}): string | undefined {
  const envelope = encodeHomeStoreSnapshot({
    key,
    ownerScopeKey,
    records: [record],
    createdAt,
    expiresAt,
  });
  if (!envelope) {
    return undefined;
  }
  const encoded = stringUtils.stableStringify(envelope);
  return getByteLength(encoded) <= HOME_DISPLAY_SNAPSHOT_MAX_CHUNK_BYTES
    ? encoded
    : undefined;
}

export function decodeHomeDisplaySnapshotSourceChunk({
  expectedOwnerScopeKey,
  expectedSourceId,
  now,
  raw,
}: {
  expectedOwnerScopeKey: string;
  expectedSourceId: IHomeCachedSourceRecord['sourceId'];
  now: number;
  raw: string | undefined;
}): IHomeCachedSourceRecord | undefined {
  if (!raw || getByteLength(raw) > HOME_DISPLAY_SNAPSHOT_MAX_CHUNK_BYTES) {
    return undefined;
  }
  try {
    const snapshot = decodeHomeStoreSnapshot({
      envelope: JSON.parse(raw),
      expectedOwnerScopeKey,
      now,
    });
    const record = snapshot?.records[0];
    return snapshot?.records.length === 1 &&
      record?.sourceId === expectedSourceId
      ? record
      : undefined;
  } catch {
    return undefined;
  }
}

export function encodeHomeDisplaySnapshotRoute(
  value: IHomeDisplaySnapshotRoute,
): string {
  return stringUtils.stableStringify(value);
}

export function decodeHomeDisplaySnapshotRoute({
  expectedOwnerScopeKey,
  expectedPartitionId,
  now,
  raw,
}: {
  expectedOwnerScopeKey: string;
  expectedPartitionId: string;
  now: number;
  raw: string | undefined;
}): IHomeDisplaySnapshotRoute | undefined {
  if (!raw || getByteLength(raw) > 16 * 1024) {
    return undefined;
  }
  try {
    const value = JSON.parse(raw) as Partial<IHomeDisplaySnapshotRoute>;
    if (
      value.schemaVersion !== HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION ||
      value.ownerScopeKey !== expectedOwnerScopeKey ||
      value.partitionId !== expectedPartitionId ||
      !Number.isSafeInteger(value.currentGeneration) ||
      Number(value.currentGeneration) <= 0 ||
      (value.previousGeneration !== undefined &&
        (!Number.isSafeInteger(value.previousGeneration) ||
          Number(value.previousGeneration) <= 0)) ||
      !Number.isSafeInteger(value.updatedAt) ||
      !Number.isSafeInteger(value.expiresAt) ||
      Number(value.expiresAt) <= now
    ) {
      return undefined;
    }
    return value as IHomeDisplaySnapshotRoute;
  } catch {
    return undefined;
  }
}

function isChunkDescriptor({
  descriptor,
  expectedChunkId,
  expectedPartitionId,
}: {
  descriptor: unknown;
  expectedChunkId: string;
  expectedPartitionId: string;
}): boolean {
  if (!isObject(descriptor)) {
    return false;
  }
  const chunkId = descriptor.chunkId;
  return (
    isHomeDisplaySnapshotChunkId(chunkId) &&
    chunkId === expectedChunkId &&
    typeof descriptor.key === 'string' &&
    descriptor.key.startsWith(`chunk/${expectedPartitionId}/`) &&
    descriptor.key.endsWith(`/${chunkId}`) &&
    Number.isSafeInteger(descriptor.byteLength) &&
    Number(descriptor.byteLength) > 0 &&
    Number(descriptor.byteLength) <= HOME_DISPLAY_SNAPSHOT_MAX_CHUNK_BYTES &&
    typeof descriptor.contentSignature === 'string' &&
    descriptor.contentSignature.length > 0 &&
    Number.isSafeInteger(descriptor.updatedAt) &&
    Number.isSafeInteger(descriptor.expiresAt) &&
    Number(descriptor.expiresAt) > 0
  );
}

export function encodeHomeDisplaySnapshotManifest(
  value: IHomeDisplaySnapshotManifest,
): string {
  return stringUtils.stableStringify(value);
}

export function decodeHomeDisplaySnapshotManifest({
  expectedGeneration,
  expectedOwnerScopeKey,
  expectedPartitionId,
  now,
  raw,
}: {
  expectedGeneration: number;
  expectedOwnerScopeKey: string;
  expectedPartitionId: string;
  now: number;
  raw: string | undefined;
}): IHomeDisplaySnapshotManifest | undefined {
  if (!raw || getByteLength(raw) > 64 * 1024) {
    return undefined;
  }
  try {
    const value = JSON.parse(raw) as Partial<IHomeDisplaySnapshotManifest>;
    if (
      value.schemaVersion !== HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION ||
      value.ownerScopeKey !== expectedOwnerScopeKey ||
      value.partitionId !== expectedPartitionId ||
      value.generation !== expectedGeneration ||
      !Number.isSafeInteger(value.createdAt) ||
      !Number.isSafeInteger(value.expiresAt) ||
      Number(value.expiresAt) <= now ||
      !isObject(value.chunks)
    ) {
      return undefined;
    }
    const entries = Object.entries(value.chunks);
    if (
      entries.length > HOME_STORE_SOURCE_IDS.length + 1 ||
      entries.some(
        ([chunkId, descriptor]) =>
          !isHomeDisplaySnapshotChunkId(chunkId) ||
          !isChunkDescriptor({
            descriptor,
            expectedChunkId: chunkId,
            expectedPartitionId,
          }),
      )
    ) {
      return undefined;
    }
    return value as IHomeDisplaySnapshotManifest;
  } catch {
    return undefined;
  }
}

export function encodeHomeDisplaySnapshotRouteIndex(
  value: IHomeDisplaySnapshotRouteIndex,
): string {
  return stringUtils.stableStringify(value);
}

export function decodeHomeDisplaySnapshotRouteIndex(
  raw: string | undefined,
): IHomeDisplaySnapshotRouteIndex | undefined {
  if (!raw || getByteLength(raw) > 32 * 1024) {
    return undefined;
  }
  try {
    const value = JSON.parse(raw) as Partial<IHomeDisplaySnapshotRouteIndex>;
    if (
      value.schemaVersion !== HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION ||
      !Array.isArray(value.routes) ||
      value.routes.length > HOME_DISPLAY_SNAPSHOT_MAX_ROUTES ||
      value.routes.some(
        (route) =>
          !isObject(route) ||
          typeof route.partitionId !== 'string' ||
          !Number.isSafeInteger(route.lastAccessedAt),
      )
    ) {
      return undefined;
    }
    return value as IHomeDisplaySnapshotRouteIndex;
  } catch {
    return undefined;
  }
}

export function createHomeDisplaySnapshotDescriptor({
  chunkId,
  contentSignature,
  expiresAt,
  generation,
  partitionId,
  raw,
  updatedAt,
}: {
  chunkId: IHomeDisplaySnapshotChunkId;
  contentSignature: string;
  expiresAt: number;
  generation: number;
  partitionId: string;
  raw: string;
  updatedAt: number;
}): IHomeDisplaySnapshotChunkDescriptor {
  return {
    chunkId,
    key: getHomeDisplaySnapshotChunkKey(partitionId, generation, chunkId),
    byteLength: getByteLength(raw),
    contentSignature,
    updatedAt,
    expiresAt,
  };
}

export function getExpectedHomeDisplaySnapshotManifestKey({
  generation,
  partitionId,
}: {
  generation: number;
  partitionId: string;
}): string {
  return getHomeDisplaySnapshotManifestKey(partitionId, generation);
}

export { getByteLength };
