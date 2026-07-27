import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type {
  IAccountToken,
  ICustomTokenItem,
  IHomeDefaultToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import {
  buildHomeScalarKey,
  createHomeSourceKey,
  getHomeSourceKeyIdentity,
} from '../../core/homeIdentity';
import { createHomeSectionConfirmedSeed } from '../homeSectionSourceAdapter';

import type {
  IHomeSectionCoordinatorEvent,
  IHomeSectionSourceIdentity,
} from '../homeSectionCoordinator';

const HOME_SPOT_SOURCE_REVISION = 1;
const HOME_SPOT_DATA_SCHEMA_VERSION = 2;

type IHomeSpotTokenMode = 'wallet' | 'lp';

type IHomeSpotSourceParams = {
  accountOwnerId: string;
  defaultTokenRevision: string;
  enabledNetworksRevision: string;
  mergeDerive: boolean;
  networkId: string;
  networkMode: 'allNetworks' | 'singleNetwork';
  tokenMode: IHomeSpotTokenMode;
};

type IHomeSpotNativePayload = {
  customTokens: ICustomTokenItem[];
  dataScopeKey: string;
  isEmptyAccount: boolean;
  map: Record<string, ITokenFiat>;
  riskMap: Record<string, ITokenFiat>;
  riskTokens: IAccountToken[];
  smallBalanceMap: Record<string, ITokenFiat>;
  smallBalanceTokens: IAccountToken[];
  tokens: IAccountToken[];
};

type IHomeSpotLegacyPayload = {
  accountTokensValue: string;
  accountTokensValueAvailable?: boolean;
  accountTokensValueComplete?: boolean;
  accountTokensWorthCurrency?: string;
  accountWorthByNetwork?: Record<string, string>;
  aggregateTokenListMap: Record<string, { tokens: IAccountToken[] }>;
  allAggregateTokenMap: Record<string, { tokens: IAccountToken[] }>;
  blockedRiskTokenCount?: number;
  displayIds: readonly string[];
  fundedIds: readonly string[];
  generation: number;
  createAtNetworkWorth?: string;
  homeDefaultTokenMap: Record<string, IHomeDefaultToken>;
  isAllNetworkEmptyAccount: boolean;
  isLpTokenSwitchLoading: boolean;
  mergeDeriveAddressData: boolean;
  networksMap: Record<string, IServerNetwork>;
  ownerKey: string;
  riskMap: Record<string, ITokenFiat>;
  riskTokens: IAccountToken[];
  showLpTokenFilterSwitch: boolean;
  showLpTokensOnly: boolean;
  smallBalanceFiatValue?: string;
  smallBalanceMap: Record<string, ITokenFiat>;
  smallBalanceTokens: IAccountToken[];
  scopedLpTokenList: {
    keys: string;
    tokens: IAccountToken[];
  };
  scopedLpTokenListMap: Record<string, ITokenFiat>;
  scopedLpTokenListState: {
    initialized: boolean;
    isRefreshing: boolean;
  };
  tapTokenMap: Record<string, ITokenFiat>;
  tokenListMap: Record<string, ITokenFiat>;
  tokens: IAccountToken[];
};

const HOME_SPOT_SNAPSHOT_KEYS = [
  'accountTokensValue',
  'accountTokensValueAvailable',
  'accountTokensValueComplete',
  'accountTokensWorthCurrency',
  'accountWorthByNetwork',
  'aggregateTokenListMap',
  'allAggregateTokenMap',
  'blockedRiskTokenCount',
  'displayIds',
  'fundedIds',
  'generation',
  'createAtNetworkWorth',
  'homeDefaultTokenMap',
  'isAllNetworkEmptyAccount',
  'mergeDeriveAddressData',
  'networksMap',
  'ownerKey',
  'riskMap',
  'riskTokens',
  'showLpTokenFilterSwitch',
  'showLpTokensOnly',
  'smallBalanceFiatValue',
  'smallBalanceMap',
  'smallBalanceTokens',
  'scopedLpTokenList',
  'scopedLpTokenListMap',
  'tapTokenMap',
  'tokenListMap',
  'tokens',
] as const satisfies readonly (keyof IHomeSpotLegacyPayload)[];

function createHomeSpotSnapshotDefaults(): IHomeSpotLegacyPayload {
  return {
    accountTokensValue: '0',
    accountTokensValueAvailable: false,
    accountTokensValueComplete: false,
    accountTokensWorthCurrency: '',
    accountWorthByNetwork: {},
    aggregateTokenListMap: {},
    allAggregateTokenMap: {},
    blockedRiskTokenCount: 0,
    displayIds: [],
    fundedIds: [],
    generation: 0,
    createAtNetworkWorth: '0',
    homeDefaultTokenMap: {},
    isAllNetworkEmptyAccount: false,
    isLpTokenSwitchLoading: false,
    mergeDeriveAddressData: false,
    networksMap: {},
    ownerKey: '',
    riskMap: {},
    riskTokens: [],
    showLpTokenFilterSwitch: false,
    showLpTokensOnly: false,
    smallBalanceFiatValue: '0',
    smallBalanceMap: {},
    smallBalanceTokens: [],
    scopedLpTokenList: {
      keys: '',
      tokens: [],
    },
    scopedLpTokenListMap: {},
    scopedLpTokenListState: {
      initialized: true,
      isRefreshing: false,
    },
    tapTokenMap: {},
    tokenListMap: {},
    tokens: [],
  };
}

type IHomeSpotSourceSnapshot<T> =
  | { kind: 'loading'; requestSeq: number }
  | {
      kind: 'confirmedCache';
      requestSeq: number;
      data: T;
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
        | { kind: 'success'; data: T; rowIds: readonly string[] };
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

function createHomeSpotSourceIdentity({
  owner,
  params,
  producerInstanceId,
}: {
  owner: IHomeRuntimeOwnerToken;
  params: IHomeSpotSourceParams;
  producerInstanceId: string;
}): IHomeSectionSourceIdentity {
  const sourceKey = createHomeSourceKey({
    dataSchemaVersion: HOME_SPOT_DATA_SCHEMA_VERSION,
    ownerToken: owner,
    paramsFingerprint: buildHomeScalarKey([
      params.accountOwnerId,
      params.defaultTokenRevision,
      params.enabledNetworksRevision,
      params.mergeDerive,
      params.networkId,
      params.networkMode,
      params.tokenMode,
    ]),
    sourceId: 'portfolio',
  });
  return {
    owner,
    sectionId: 'portfolio',
    sourceId: 'portfolio',
    sourceKeyIdentity: getHomeSourceKeyIdentity(sourceKey),
    producerInstanceId,
    sourceRevision: HOME_SPOT_SOURCE_REVISION,
  };
}

function adaptHomeSpotSourceSnapshot<T>({
  identity,
  snapshot,
}: {
  identity: IHomeSectionSourceIdentity;
  snapshot: IHomeSpotSourceSnapshot<T>;
}): IHomeSectionCoordinatorEvent<T> {
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
  HOME_SPOT_DATA_SCHEMA_VERSION,
  HOME_SPOT_SNAPSHOT_KEYS,
  HOME_SPOT_SOURCE_REVISION,
  adaptHomeSpotSourceSnapshot,
  createHomeSpotSnapshotDefaults,
  createHomeSpotSourceIdentity,
};
export type {
  IHomeSpotLegacyPayload,
  IHomeSpotNativePayload,
  IHomeSpotSourceParams,
  IHomeSpotSourceSnapshot,
  IHomeSpotTokenMode,
};
