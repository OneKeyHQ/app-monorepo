import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type {
  IAccountToken,
  ICustomTokenItem,
  IHomeDefaultToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import {
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
const HOME_SPOT_SNAPSHOT_TOKEN_LIMIT = 50;

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
  accountTokensWorthCurrency?: string;
  aggregateTokenListMap: Record<string, { tokens: IAccountToken[] }>;
  allAggregateTokenMap: Record<string, { tokens: IAccountToken[] }>;
  blockedRiskTokenCount?: number;
  displayIds: readonly string[];
  fundedIds: readonly string[];
  generation: number;
  homeDefaultTokenMap: Record<string, IHomeDefaultToken>;
  isAllNetworkEmptyAccount: boolean;
  isLpTokenSwitchLoading: boolean;
  mergeDeriveAddressData: boolean;
  networksMap: Record<string, IServerNetwork>;
  ownerKey: string;
  riskMap: Record<string, ITokenFiat>;
  riskTokenCount?: number;
  riskTokens: IAccountToken[];
  showLpTokenFilterSwitch: boolean;
  showLpTokensOnly: boolean;
  smallBalanceFiatValue?: string;
  smallBalanceMap: Record<string, ITokenFiat>;
  smallBalanceTokenCount?: number;
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
  tokenCount?: number;
  tokens: IAccountToken[];
};

const HOME_SPOT_SNAPSHOT_KEYS = [
  'accountTokensValue',
  'accountTokensWorthCurrency',
  'aggregateTokenListMap',
  'allAggregateTokenMap',
  'blockedRiskTokenCount',
  'displayIds',
  'fundedIds',
  'generation',
  'homeDefaultTokenMap',
  'isAllNetworkEmptyAccount',
  'mergeDeriveAddressData',
  'networksMap',
  'ownerKey',
  'riskTokenCount',
  'showLpTokenFilterSwitch',
  'showLpTokensOnly',
  'smallBalanceFiatValue',
  'smallBalanceTokenCount',
  'tokenListMap',
  'tokenCount',
  'tokens',
] as const satisfies readonly (keyof IHomeSpotLegacyPayload)[];

function createHomeSpotSnapshotDefaults(): IHomeSpotLegacyPayload {
  return {
    accountTokensValue: '0',
    accountTokensWorthCurrency: '',
    aggregateTokenListMap: {},
    allAggregateTokenMap: {},
    blockedRiskTokenCount: 0,
    displayIds: [],
    fundedIds: [],
    generation: 0,
    homeDefaultTokenMap: {},
    isAllNetworkEmptyAccount: false,
    isLpTokenSwitchLoading: false,
    mergeDeriveAddressData: false,
    networksMap: {},
    ownerKey: '',
    riskMap: {},
    riskTokenCount: 0,
    riskTokens: [],
    showLpTokenFilterSwitch: false,
    showLpTokensOnly: false,
    smallBalanceFiatValue: '0',
    smallBalanceMap: {},
    smallBalanceTokenCount: 0,
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
    tokenCount: 0,
    tokens: [],
  };
}

function pickRecordFields<T>(
  record: Record<string, T>,
  keys: ReadonlySet<string>,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => keys.has(key)),
  );
}

function projectHomeSpotSnapshotData(
  value: IHomeSpotLegacyPayload,
): IHomeSpotLegacyPayload {
  const displayOrder = new Map(
    value.displayIds.map((id, index) => [id, index]),
  );
  const tokens = value.tokens
    .filter((token) => displayOrder.has(token.$key))
    .toSorted(
      (left, right) =>
        (displayOrder.get(left.$key) ?? Number.MAX_SAFE_INTEGER) -
        (displayOrder.get(right.$key) ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, HOME_SPOT_SNAPSHOT_TOKEN_LIMIT);
  const tokenIds = new Set(tokens.map((token) => token.$key));
  const networkIds = new Set(
    tokens
      .map((token) => token.networkId)
      .filter((networkId): networkId is string => Boolean(networkId)),
  );
  return {
    ...createHomeSpotSnapshotDefaults(),
    accountTokensValue: value.accountTokensValue,
    accountTokensWorthCurrency: value.accountTokensWorthCurrency,
    blockedRiskTokenCount: value.blockedRiskTokenCount,
    displayIds: tokens.map((token) => token.$key),
    fundedIds: value.fundedIds.filter((id) => tokenIds.has(id)),
    generation: value.generation,
    isAllNetworkEmptyAccount: value.isAllNetworkEmptyAccount,
    mergeDeriveAddressData: value.mergeDeriveAddressData,
    networksMap: pickRecordFields(value.networksMap, networkIds),
    ownerKey: value.ownerKey,
    riskTokenCount: value.riskTokenCount ?? value.riskTokens.length,
    showLpTokenFilterSwitch: value.showLpTokenFilterSwitch,
    showLpTokensOnly: value.showLpTokensOnly,
    smallBalanceFiatValue: value.smallBalanceFiatValue,
    smallBalanceTokenCount:
      value.smallBalanceTokenCount ?? value.smallBalanceTokens.length,
    tokenCount: value.tokenCount ?? value.tokens.length,
    tokenListMap: pickRecordFields(value.tokenListMap, tokenIds),
    tokens,
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
    paramsFingerprint: stringUtils.stableStringify(params),
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
  HOME_SPOT_SNAPSHOT_TOKEN_LIMIT,
  HOME_SPOT_SOURCE_REVISION,
  adaptHomeSpotSourceSnapshot,
  createHomeSpotSnapshotDefaults,
  createHomeSpotSourceIdentity,
  projectHomeSpotSnapshotData,
};
export type {
  IHomeSpotLegacyPayload,
  IHomeSpotNativePayload,
  IHomeSpotSourceParams,
  IHomeSpotSourceSnapshot,
  IHomeSpotTokenMode,
};
