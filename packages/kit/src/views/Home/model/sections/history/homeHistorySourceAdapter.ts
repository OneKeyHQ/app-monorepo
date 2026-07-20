import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { IAddressBadge } from '@onekeyhq/shared/types/address';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import {
  createHomeSourceKey,
  getHomeSourceKeyIdentity,
} from '../../core/homeIdentity';
import { createHomeSectionConfirmedSeed } from '../homeSectionSourceAdapter';

import type {
  IHomeSectionCoordinatorEvent,
  IHomeSectionSourceIdentity,
} from '../homeSectionCoordinator';

const HOME_HISTORY_SOURCE_REVISION = 1;
const HOME_HISTORY_DATA_SCHEMA_VERSION = 1;

type IHomeHistorySourceParams = {
  accountId: string;
  accountOwnerId: string;
  filterLowValue: boolean;
  filterScam: boolean;
  indexedAccountId: string | undefined;
  mergeDerive: boolean;
  networkId: string;
  networkMode: 'allNetworks' | 'singleNetwork';
  sourceCurrencyId: string;
  walletId: string;
};

type IHomeHistoryLegacyPayload = {
  addressMap: Record<string, IAddressBadge>;
  data: IAccountHistoryTx[];
};

type IHomeHistorySourceSnapshot =
  | { kind: 'loading'; requestSeq: number }
  | {
      kind: 'confirmedCache';
      requestSeq: number;
      data: IHomeHistoryLegacyPayload;
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
            data: IHomeHistoryLegacyPayload;
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

function getHomeHistoryRowIds(
  data: IHomeHistoryLegacyPayload,
): readonly string[] {
  return data.data.map((tx) => tx.id);
}

function createHomeHistorySourceIdentity({
  owner,
  params,
  producerInstanceId,
}: {
  owner: IHomeRuntimeOwnerToken;
  params: IHomeHistorySourceParams;
  producerInstanceId: string;
}): IHomeSectionSourceIdentity {
  const sourceKey = createHomeSourceKey({
    dataSchemaVersion: HOME_HISTORY_DATA_SCHEMA_VERSION,
    ownerToken: owner,
    paramsFingerprint: stringUtils.stableStringify(params),
    sourceId: 'history',
  });
  return {
    owner,
    sectionId: 'history',
    sourceId: 'history',
    sourceKeyIdentity: getHomeSourceKeyIdentity(sourceKey),
    producerInstanceId,
    sourceRevision: HOME_HISTORY_SOURCE_REVISION,
  };
}

function adaptHomeHistorySourceSnapshot({
  identity,
  snapshot,
}: {
  identity: IHomeSectionSourceIdentity;
  snapshot: IHomeHistorySourceSnapshot;
}): IHomeSectionCoordinatorEvent<IHomeHistoryLegacyPayload> {
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
  HOME_HISTORY_DATA_SCHEMA_VERSION,
  HOME_HISTORY_SOURCE_REVISION,
  adaptHomeHistorySourceSnapshot,
  createHomeHistorySourceIdentity,
  getHomeHistoryRowIds,
};
export type {
  IHomeHistoryLegacyPayload,
  IHomeHistorySourceParams,
  IHomeHistorySourceSnapshot,
};
