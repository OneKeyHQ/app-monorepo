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
const HOME_MARKET_DATA_SCHEMA_VERSION = 1;

type IHomeMarketTokenRow = {
  chainId: string;
  contractAddress: string;
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
  favoriteMode: 'favorites' | 'recommendation';
  prefetchCategoryIds: readonly string[];
  prefetchedRowsByRequestKey: Readonly<Record<string, readonly TToken[]>>;
  resolvedCategoryId: string;
  rows: readonly TToken[];
  selectedCategoryId: string;
  totalFavorites: number;
  watchListContentKey: string;
};

type IHomeMarketSourceSnapshot<TToken extends IHomeMarketTokenRow> =
  | { kind: 'loading'; requestSeq: number }
  | {
      kind: 'confirmedCache';
      requestSeq: number;
      data: IHomeMarketLegacyPayload<TToken>;
      rowIds: readonly string[];
      refresh: 'idle' | 'refreshing';
    }
  | {
      kind: 'partial';
      requestSeq: number;
      coverageFingerprint: string;
    }
  | {
      kind: 'complete';
      requestSeq: number;
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
      requestSeq: number;
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
  return data.rows.map(getHomeMarketTokenRowId);
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
      return { ...identity, kind: 'loading', requestSeq: snapshot.requestSeq };
    case 'confirmedCache':
      return createHomeSectionConfirmedSeed({
        data: snapshot.data,
        getRowIds: () => snapshot.rowIds,
        identity,
        refresh: snapshot.refresh,
        requestSeq: snapshot.requestSeq,
      });
    case 'partial':
      return { ...identity, ...snapshot };
    case 'complete':
      return { ...identity, ...snapshot };
    case 'error':
      return { ...identity, ...snapshot };
    default:
      return { ...identity, kind: 'loading', requestSeq: 0 };
  }
}

export {
  HOME_MARKET_DATA_SCHEMA_VERSION,
  HOME_MARKET_SOURCE_REVISION,
  adaptHomeMarketSourceSnapshot,
  createHomeMarketSourceIdentity,
  getHomeMarketRowIds,
  getHomeMarketTokenRowId,
};
export type {
  IHomeMarketLegacyPayload,
  IHomeMarketSourceParams,
  IHomeMarketSourceSnapshot,
  IHomeMarketTokenRow,
};
