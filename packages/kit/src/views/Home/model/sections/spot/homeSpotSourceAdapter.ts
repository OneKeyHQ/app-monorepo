import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  IAccountToken,
  ICustomTokenItem,
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
const HOME_SPOT_DATA_SCHEMA_VERSION = 1;

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
  displayIds: readonly string[];
  generation: number;
  ownerKey: string;
};

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
  HOME_SPOT_SOURCE_REVISION,
  adaptHomeSpotSourceSnapshot,
  createHomeSpotSourceIdentity,
};
export type {
  IHomeSpotLegacyPayload,
  IHomeSpotNativePayload,
  IHomeSpotSourceParams,
  IHomeSpotSourceSnapshot,
  IHomeSpotTokenMode,
};
