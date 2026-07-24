import type { IHomePerpsDestination } from '../capabilities/homeCapabilityTypes';
import type {
  IHomeActionId,
  IHomeMoneyViewModel,
  IHomeNavigationSemanticModel,
  IHomeSectionId,
  IHomeShellSemanticModel,
  IHomeTabId,
} from '../semantic/homeSemanticTypes';
import type {
  IHomeCachedSourceRecord,
  IHomeStoreSourceId,
} from '../store/homeStoreTypes';

export const HOME_DISPLAY_SNAPSHOT_ARCHITECTURE_VERSION = 3 as const;
export const HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION = 1 as const;
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
};

export type IHomeDisplaySnapshotRoute = {
  schemaVersion: typeof HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION;
  ownerScopeKey: string;
  partitionId: string;
  currentGeneration: number;
  previousGeneration?: number;
  updatedAt: number;
};

export type IHomeDisplaySnapshotManifest = {
  schemaVersion: typeof HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION;
  ownerScopeKey: string;
  partitionId: string;
  generation: number;
  createdAt: number;
  chunks: Readonly<
    Partial<
      Record<IHomeDisplaySnapshotChunkId, IHomeDisplaySnapshotChunkDescriptor>
    >
  >;
};

type IHomeDisplaySnapshotPortfolioPresentation =
  | {
      kind: 'funded';
      header: {
        kind: 'funded';
        balance: IHomeMoneyViewModel;
      };
      actions: { kind: 'funded'; items: readonly IHomeActionId[] };
      banner: { kind: 'positive' } | { kind: 'none' };
    }
  | {
      kind: 'zero';
      header: { kind: 'zero'; balance: IHomeMoneyViewModel };
      actions: { kind: 'zero'; items: readonly IHomeActionId[] };
      banner: { kind: 'none' };
    };

export type IHomeDisplaySnapshotPersistedShell = {
  kind: 'portfolio';
  presentation: IHomeDisplaySnapshotPortfolioPresentation;
};

export type IHomeDisplaySnapshotPersistedNavigation = {
  kind: 'ready';
  tabs: readonly [IHomeTabId, ...IHomeTabId[]];
  destinations?: Readonly<Partial<Record<IHomeTabId, 'inline' | 'web'>>>;
  perpsDestination?: IHomePerpsDestination;
  sections?: Readonly<Record<IHomeSectionId, boolean>>;
};

export type IHomeDisplaySnapshotPersistedCritical = {
  schemaVersion: typeof HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION;
  ownerScopeKey: string;
  createdAt: number;
  shell?: IHomeDisplaySnapshotPersistedShell;
  navigation?: IHomeDisplaySnapshotPersistedNavigation;
};

export type IHomeDisplaySnapshotCritical = {
  schemaVersion: typeof HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION;
  ownerScopeKey: string;
  createdAt: number;
  shell?: IHomeShellSemanticModel;
  navigation?: IHomeNavigationSemanticModel;
};

export type IHomeDisplaySnapshotSourceChunk = {
  schemaVersion: typeof HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION;
  ownerScopeKey: string;
  record: IHomeCachedSourceRecord;
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
