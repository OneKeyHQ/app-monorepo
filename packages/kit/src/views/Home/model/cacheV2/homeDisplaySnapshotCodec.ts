import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { HOME_STORE_SOURCE_IDS } from '../store/homeStoreTypes';

import {
  projectHomeDisplaySnapshotRecord,
  restoreHomeDisplaySnapshotRecord,
} from './homeDisplaySnapshotData';
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
  IHomeDisplaySnapshotPersistedCritical,
  IHomeDisplaySnapshotPersistedNavigation,
  IHomeDisplaySnapshotPersistedShell,
  IHomeDisplaySnapshotRoute,
  IHomeDisplaySnapshotRouteIndex,
  IHomeDisplaySnapshotSourceChunk,
} from './homeDisplaySnapshotTypes';
import type {
  IHomeNavigationSemanticModel,
  IHomeShellSemanticModel,
  IHomeTabId,
} from '../semantic/homeSemanticTypes';
import type {
  IHomeCachedSourceRecord,
  IHomeStoreSourceId,
} from '../store/homeStoreTypes';

const HOME_DISPLAY_SNAPSHOT_NO_EXPIRY_AT = Number.MAX_SAFE_INTEGER;

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

export function projectHomeDisplaySnapshotShell(
  shell: IHomeShellSemanticModel,
): IHomeDisplaySnapshotPersistedShell | undefined {
  if (shell.kind !== 'portfolio') {
    return undefined;
  }
  const presentation = shell.presentation;
  if (presentation.kind === 'funded') {
    return {
      kind: 'portfolio',
      presentation: {
        kind: presentation.kind,
        header: {
          kind: presentation.header.kind,
          balance: presentation.header.balance,
        },
        actions: presentation.actions,
        banner: presentation.banner,
      },
    };
  }
  if (presentation.kind === 'zero') {
    return {
      kind: 'portfolio',
      presentation: {
        kind: presentation.kind,
        header: presentation.header,
        actions: presentation.actions,
        banner: presentation.banner,
      },
    };
  }
  return undefined;
}

export function projectHomeDisplaySnapshotNavigation(
  navigation: IHomeNavigationSemanticModel,
): IHomeDisplaySnapshotPersistedNavigation | undefined {
  if (navigation.kind !== 'ready') {
    return undefined;
  }
  if (navigation.destinations) {
    return {
      kind: navigation.kind,
      tabs: navigation.tabs,
      destinations: navigation.destinations,
      perpsDestination: navigation.perpsDestination,
      sections: navigation.sections,
    };
  }
  return {
    kind: navigation.kind,
    tabs: navigation.tabs,
  };
}

export function encodeHomeDisplaySnapshotCritical(
  value: IHomeDisplaySnapshotPersistedCritical,
): string | undefined {
  const encoded = stringUtils.stableStringify(value);
  return getByteLength(encoded) <= HOME_DISPLAY_SNAPSHOT_MAX_CRITICAL_BYTES
    ? encoded
    : undefined;
}

export function decodeHomeDisplaySnapshotCritical({
  expectedOwnerScopeKey,
  raw,
}: {
  expectedOwnerScopeKey: string;
  raw: string | undefined;
}): IHomeDisplaySnapshotCritical | undefined {
  if (!raw || getByteLength(raw) > HOME_DISPLAY_SNAPSHOT_MAX_CRITICAL_BYTES) {
    return undefined;
  }
  try {
    const value = JSON.parse(
      raw,
    ) as Partial<IHomeDisplaySnapshotPersistedCritical>;
    if (
      value.schemaVersion !== HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION ||
      value.ownerScopeKey !== expectedOwnerScopeKey ||
      typeof value.createdAt !== 'number' ||
      !Number.isSafeInteger(value.createdAt)
    ) {
      return undefined;
    }
    const shell = restoreHomeDisplaySnapshotShell(value.shell);
    const navigation = restoreHomeDisplaySnapshotNavigation(value.navigation);
    if (
      (value.shell !== undefined && !shell) ||
      (value.navigation !== undefined && !navigation)
    ) {
      return undefined;
    }
    return {
      schemaVersion: value.schemaVersion,
      ownerScopeKey: value.ownerScopeKey,
      createdAt: value.createdAt,
      shell,
      navigation,
    };
  } catch {
    return undefined;
  }
}

function restoreHomeDisplaySnapshotShell(
  value: unknown,
): IHomeShellSemanticModel | undefined {
  if (
    !isObject(value) ||
    value.kind !== 'portfolio' ||
    !isObject(value.presentation) ||
    !isObject(value.presentation.header) ||
    !isObject(value.presentation.actions) ||
    !isObject(value.presentation.banner)
  ) {
    return undefined;
  }
  const presentation =
    value.presentation as IHomeDisplaySnapshotPersistedShell['presentation'];
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

function restoreHomeDisplaySnapshotNavigation(
  value: unknown,
): IHomeNavigationSemanticModel | undefined {
  if (
    !isObject(value) ||
    value.kind !== 'ready' ||
    !Array.isArray(value.tabs) ||
    value.tabs.length === 0 ||
    !value.tabs.every(isHomeTabId)
  ) {
    return undefined;
  }
  const tabs = value.tabs as [IHomeTabId, ...IHomeTabId[]];
  const selectedTabId = tabs.includes('portfolio') ? 'portfolio' : tabs[0];
  if (
    isObject(value.destinations) &&
    typeof value.perpsDestination === 'string' &&
    isObject(value.sections)
  ) {
    const navigation =
      value as unknown as IHomeDisplaySnapshotPersistedNavigation;
    return {
      kind: 'ready',
      tabs,
      selectedTabId,
      destinations: navigation.destinations ?? {},
      freshness: 'confirmedCache',
      perpsDestination: navigation.perpsDestination as NonNullable<
        typeof navigation.perpsDestination
      >,
      refresh: 'refreshing',
      sections: navigation.sections as NonNullable<typeof navigation.sections>,
    };
  }
  return {
    kind: 'ready',
    tabs,
    selectedTabId,
  };
}

export function encodeHomeDisplaySnapshotSourceChunk({
  ownerScopeKey,
  record,
}: {
  ownerScopeKey: string;
  record: IHomeCachedSourceRecord;
}): string | undefined {
  const projectedRecord = projectHomeDisplaySnapshotRecord(record);
  if (!projectedRecord) {
    return undefined;
  }
  const chunk: IHomeDisplaySnapshotSourceChunk = {
    schemaVersion: HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION,
    ownerScopeKey,
    record: {
      ...projectedRecord,
      confirmedAt: 0,
      expiresAt: HOME_DISPLAY_SNAPSHOT_NO_EXPIRY_AT,
    },
  };
  const encoded = stringUtils.stableStringify(chunk);
  return getByteLength(encoded) <= HOME_DISPLAY_SNAPSHOT_MAX_CHUNK_BYTES
    ? encoded
    : undefined;
}

function readPersistedSourceRecord(
  value: unknown,
): IHomeCachedSourceRecord | undefined {
  if (!isObject(value)) {
    return undefined;
  }
  const record = value as Partial<IHomeCachedSourceRecord>;
  if (
    !HOME_STORE_SOURCE_IDS.some((sourceId) => sourceId === record.sourceId) ||
    typeof record.sourceKeyIdentity !== 'string' ||
    typeof record.dataSchemaVersion !== 'number' ||
    !Number.isSafeInteger(record.dataSchemaVersion) ||
    typeof record.coverageFingerprint !== 'string' ||
    typeof record.confirmedAt !== 'number' ||
    !Number.isSafeInteger(record.confirmedAt) ||
    !isObject(record.payload)
  ) {
    return undefined;
  }
  return {
    sourceId: record.sourceId as IHomeStoreSourceId,
    sourceKeyIdentity: record.sourceKeyIdentity,
    dataSchemaVersion: record.dataSchemaVersion,
    coverageFingerprint: record.coverageFingerprint,
    quoteBasis:
      record.quoteBasis && isObject(record.quoteBasis)
        ? (record.quoteBasis as IHomeCachedSourceRecord['quoteBasis'])
        : null,
    confirmedAt: record.confirmedAt,
    expiresAt: HOME_DISPLAY_SNAPSHOT_NO_EXPIRY_AT,
    payload: record.payload as IHomeCachedSourceRecord['payload'],
  };
}

export function decodeHomeDisplaySnapshotSourceChunk({
  expectedOwnerScopeKey,
  expectedSourceId,
  raw,
}: {
  expectedOwnerScopeKey: string;
  expectedSourceId: IHomeCachedSourceRecord['sourceId'];
  raw: string | undefined;
}): IHomeCachedSourceRecord | undefined {
  if (!raw || getByteLength(raw) > HOME_DISPLAY_SNAPSHOT_MAX_CHUNK_BYTES) {
    return undefined;
  }
  try {
    const chunk = JSON.parse(raw) as Partial<IHomeDisplaySnapshotSourceChunk>;
    if (
      chunk.schemaVersion !== HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION ||
      chunk.ownerScopeKey !== expectedOwnerScopeKey
    ) {
      return undefined;
    }
    const record = readPersistedSourceRecord(chunk.record);
    return record?.sourceId === expectedSourceId
      ? restoreHomeDisplaySnapshotRecord(record)
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
  raw,
}: {
  expectedOwnerScopeKey: string;
  expectedPartitionId: string;
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
      !Number.isSafeInteger(value.updatedAt)
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
    Number.isSafeInteger(descriptor.updatedAt)
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
  raw,
}: {
  expectedGeneration: number;
  expectedOwnerScopeKey: string;
  expectedPartitionId: string;
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
  generation,
  partitionId,
  raw,
  updatedAt,
}: {
  chunkId: IHomeDisplaySnapshotChunkId;
  contentSignature: string;
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
