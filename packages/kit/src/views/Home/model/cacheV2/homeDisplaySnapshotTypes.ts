import type {
  IHomeNavigationSemanticModel,
  IHomeShellSemanticModel,
  IHomeTabId,
} from '../semantic/homeSemanticTypes';
import type {
  IHomeCachedSourceRecord,
  IHomeStoreSourceId,
} from '../store/homeStoreTypes';

export const HOME_DISPLAY_SNAPSHOT_ARCHITECTURE_VERSION = 2 as const;
export const HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION = 1 as const;
export const HOME_DISPLAY_SNAPSHOT_TTL_MS = 30 * 60 * 1000;
export const HOME_DISPLAY_SNAPSHOT_MAX_CHUNK_BYTES = 1024 * 1024;
export const HOME_DISPLAY_SNAPSHOT_MAX_CRITICAL_BYTES = 128 * 1024;
export const HOME_DISPLAY_SNAPSHOT_MAX_ROUTES = 16;

export type IHomeDisplaySnapshotChunkId = 'critical' | IHomeStoreSourceId;

export type IHomeDisplaySnapshotChunkDescriptor = {
  chunkId: IHomeDisplaySnapshotChunkId;
  key: string;
  byteLength: number;
  contentSignature: string;
  updatedAt: number;
  expiresAt: number;
};

export type IHomeDisplaySnapshotRoute = {
  schemaVersion: typeof HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION;
  ownerScopeKey: string;
  partitionId: string;
  currentGeneration: number;
  previousGeneration?: number;
  updatedAt: number;
  expiresAt: number;
};

export type IHomeDisplaySnapshotManifest = {
  schemaVersion: typeof HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION;
  ownerScopeKey: string;
  partitionId: string;
  generation: number;
  createdAt: number;
  expiresAt: number;
  chunks: Readonly<
    Partial<
      Record<IHomeDisplaySnapshotChunkId, IHomeDisplaySnapshotChunkDescriptor>
    >
  >;
};

export type IHomeDisplaySnapshotCritical = {
  schemaVersion: typeof HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION;
  ownerScopeKey: string;
  createdAt: number;
  expiresAt: number;
  shell?: IHomeShellSemanticModel;
  navigation?: IHomeNavigationSemanticModel;
  selectedTabPreference?: IHomeTabId;
};

export type IHomeDisplaySnapshotRouteIndex = {
  schemaVersion: typeof HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION;
  routes: readonly {
    partitionId: string;
    lastAccessedAt: number;
  }[];
};

export type ILoadedHomeDisplaySnapshotManifest = {
  routeRaw: string;
  route: IHomeDisplaySnapshotRoute;
  manifest: IHomeDisplaySnapshotManifest;
};

export type ILoadedHomeDisplaySnapshot = {
  critical?: IHomeDisplaySnapshotCritical;
  records: readonly IHomeCachedSourceRecord[];
};
