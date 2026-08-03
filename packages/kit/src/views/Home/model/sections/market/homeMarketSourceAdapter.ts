import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import {
  createHomeSourceKey,
  getHomeSourceKeyIdentity,
} from '../../core/homeIdentity';
import { createHomeSectionConfirmedSeed } from '../homeSectionSourceAdapter';

import type {
  IHomeSectionCoordinatorEvent,
  IHomeSectionSourceIdentity,
} from '../homeSectionCoordinator';

const HOME_MARKET_SOURCE_REVISION = 1;
const HOME_MARKET_DATA_SCHEMA_VERSION = 2;
const HOME_MARKET_SNAPSHOT_EARN_ROW_LIMIT = 6;
const HOME_MARKET_SNAPSHOT_PERPS_ROW_LIMIT = 5;
const HOME_MARKET_SNAPSHOT_ROW_LIMIT = 4;

type IHomeMarketTokenRow = {
  chainId: string;
  contractAddress: string;
  isNative?: boolean;
  perpsCoin?: string;
};

type IHomeMarketCategory = {
  id: string;
  name: string;
  icon?: string;
  iconName?: string;
  iconOnly?: boolean;
  isStockCategory?: boolean;
};

type IHomeMarketWatchListItem = {
  chainId: string;
  contractAddress: string;
  sortIndex?: number;
  isNative?: boolean;
  perpsCoin?: string;
};

type IHomeMarketSourceParams = {
  favoriteMode: 'favorites' | 'recommendation';
  homeTabConfigKey: string;
  minLiquidity: number;
  perpsHotEnabled: boolean;
  prefetchCategoryIds: readonly string[];
  resolvedCategoryId: string;
  selectedCategoryId: string;
  watchListContentKey: string;
};

type IHomeMarketLegacyPayload<TToken extends IHomeMarketTokenRow> = {
  categories?: readonly IHomeMarketCategory[];
  favoriteMode: 'favorites' | 'recommendation';
  prefetchCategoryIds: readonly string[];
  prefetchedRowsByRequestKey: Readonly<Record<string, readonly TToken[]>>;
  resolvedCategoryId: string;
  rows: readonly TToken[];
  perpsHotRows?: readonly TToken[];
  selectedCategoryId: string;
  totalFavorites: number;
  watchListContentKey: string;
  watchListItems?: readonly IHomeMarketWatchListItem[];
};

type IHomeMarketSnapshotPayload<TToken extends IHomeMarketTokenRow> =
  IHomeMarketLegacyPayload<TToken> & {
    categories: readonly IHomeMarketCategory[];
    earnRows: readonly unknown[];
    perpsHotRows: readonly TToken[];
    watchListItems: readonly IHomeMarketWatchListItem[];
  };

type IHomeMarketSourceSnapshot<TToken extends IHomeMarketTokenRow> =
  | { kind: 'loading' }
  | {
      kind: 'confirmedCache';
      data: IHomeMarketLegacyPayload<TToken>;
      rowIds: readonly string[];
      refresh: 'idle' | 'refreshing';
    }
  | {
      kind: 'partial';
      coverageFingerprint: string;
    }
  | {
      kind: 'complete';
      coverageFingerprint: string;
      result:
        | { kind: 'empty' }
        | {
            kind: 'success';
            data: IHomeMarketLegacyPayload<TToken>;
            rowIds: readonly string[];
          };
    }
  | {
      kind: 'error';
      errorKind:
        | 'source'
        | 'transport'
        | 'schemaMismatch'
        | 'runtimeUnavailable';
    };

function getHomeMarketTokenRowId(token: IHomeMarketTokenRow): string {
  if (token.perpsCoin) {
    return `perps:${token.perpsCoin}`;
  }
  return `spot:${token.chainId}:${
    token.isNative ? 'native' : token.contractAddress
  }`;
}

function getHomeMarketRowIds<TToken extends IHomeMarketTokenRow>(
  data: IHomeMarketLegacyPayload<TToken>,
): readonly string[] {
  return [...data.rows, ...(data.perpsHotRows ?? [])].map(
    getHomeMarketTokenRowId,
  );
}

function isSameMarketRow(
  row: IHomeMarketTokenRow,
  watchListItem: IHomeMarketWatchListItem,
): boolean {
  return row.perpsCoin
    ? row.perpsCoin === watchListItem.perpsCoin
    : row.chainId === watchListItem.chainId &&
        row.contractAddress.toLowerCase() ===
          watchListItem.contractAddress.toLowerCase();
}

function createHomeMarketSnapshotDefaults(): IHomeMarketSnapshotPayload<IHomeMarketTokenRow> {
  return {
    categories: [],
    earnRows: [],
    favoriteMode: 'favorites',
    perpsHotRows: [],
    prefetchCategoryIds: [],
    prefetchedRowsByRequestKey: {},
    resolvedCategoryId: '',
    rows: [],
    selectedCategoryId: '',
    totalFavorites: 0,
    watchListContentKey: '',
    watchListItems: [],
  };
}

function projectHomeMarketSnapshotData<TToken extends IHomeMarketTokenRow>(
  value: IHomeMarketSnapshotPayload<TToken>,
): IHomeMarketSnapshotPayload<TToken> {
  const source = {
    ...createHomeMarketSnapshotDefaults(),
    ...value,
  } as IHomeMarketSnapshotPayload<TToken>;
  const rows = source.rows.slice(0, HOME_MARKET_SNAPSHOT_ROW_LIMIT);
  const perpsHotRows = source.perpsHotRows.slice(
    0,
    HOME_MARKET_SNAPSHOT_PERPS_ROW_LIMIT,
  );
  const visibleRows = [...rows, ...perpsHotRows];
  return {
    categories: source.categories,
    earnRows: source.earnRows.slice(0, HOME_MARKET_SNAPSHOT_EARN_ROW_LIMIT),
    favoriteMode: source.favoriteMode,
    perpsHotRows,
    prefetchCategoryIds: [],
    prefetchedRowsByRequestKey: {},
    resolvedCategoryId: source.resolvedCategoryId,
    rows,
    selectedCategoryId: source.selectedCategoryId,
    totalFavorites: source.totalFavorites,
    watchListContentKey: source.watchListContentKey,
    watchListItems: source.watchListItems.filter((watchListItem) =>
      visibleRows.some((row) => isSameMarketRow(row, watchListItem)),
    ),
  };
}

function createHomeMarketSourceIdentity({
  owner,
  params,
  producerInstanceId,
}: {
  owner: IHomeRuntimeOwnerToken;
  params: IHomeMarketSourceParams;
  producerInstanceId: string;
}): IHomeSectionSourceIdentity {
  const sourceKey = createHomeSourceKey({
    dataSchemaVersion: HOME_MARKET_DATA_SCHEMA_VERSION,
    ownerToken: owner,
    paramsFingerprint: stringUtils.stableStringify(params),
    sourceId: 'market',
  });
  return {
    owner,
    sectionId: 'market',
    sourceId: 'market',
    sourceKeyIdentity: getHomeSourceKeyIdentity(sourceKey),
    producerInstanceId,
    sourceRevision: HOME_MARKET_SOURCE_REVISION,
  };
}

function adaptHomeMarketSourceSnapshot<TToken extends IHomeMarketTokenRow>({
  identity,
  snapshot,
}: {
  identity: IHomeSectionSourceIdentity;
  snapshot: IHomeMarketSourceSnapshot<TToken>;
}): IHomeSectionCoordinatorEvent<IHomeMarketLegacyPayload<TToken>> {
  switch (snapshot.kind) {
    case 'loading':
      return { ...identity, kind: 'loading' };
    case 'confirmedCache':
      return createHomeSectionConfirmedSeed({
        data: snapshot.data,
        getRowIds: () => snapshot.rowIds,
        identity,
        refresh: snapshot.refresh,
      });
    case 'partial':
      return { ...identity, kind: 'partial' };
    case 'complete':
      return { ...identity, kind: 'complete', result: snapshot.result };
    case 'error':
      return { ...identity, kind: 'error' };
    default:
      return { ...identity, kind: 'loading' };
  }
}

export {
  HOME_MARKET_DATA_SCHEMA_VERSION,
  HOME_MARKET_SNAPSHOT_EARN_ROW_LIMIT,
  HOME_MARKET_SNAPSHOT_PERPS_ROW_LIMIT,
  HOME_MARKET_SNAPSHOT_ROW_LIMIT,
  HOME_MARKET_SOURCE_REVISION,
  adaptHomeMarketSourceSnapshot,
  createHomeMarketSnapshotDefaults,
  createHomeMarketSourceIdentity,
  getHomeMarketRowIds,
  getHomeMarketTokenRowId,
  projectHomeMarketSnapshotData,
};
export type {
  IHomeMarketCategory,
  IHomeMarketLegacyPayload,
  IHomeMarketSourceParams,
  IHomeMarketSourceSnapshot,
  IHomeMarketSnapshotPayload,
  IHomeMarketTokenRow,
  IHomeMarketWatchListItem,
};
