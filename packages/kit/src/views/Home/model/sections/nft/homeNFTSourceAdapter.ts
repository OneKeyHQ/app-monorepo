import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

import {
  createHomeSourceKey,
  getHomeSourceKeyIdentity,
} from '../../core/homeIdentity';
import { createHomeSectionConfirmedSeed } from '../homeSectionSourceAdapter';

import type {
  IHomeSectionCoordinatorEvent,
  IHomeSectionSourceIdentity,
} from '../homeSectionCoordinator';

const HOME_NFT_SOURCE_REVISION = 1;
const HOME_NFT_DATA_SCHEMA_VERSION = 1;

type IHomeNFTSourceParams = {
  accountId: string;
  indexedAccountId: string | undefined;
  networkId: string;
  walletId: string;
  networkMode: 'allNetworks' | 'singleNetwork';
};

type IHomeNFTLegacyPayload = {
  data: IAccountNFT[];
};

type IHomeNFTSourceSnapshot =
  | { kind: 'loading'; requestSeq: number }
  | {
      kind: 'confirmedCache';
      requestSeq: number;
      data: IHomeNFTLegacyPayload;
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
            data: IHomeNFTLegacyPayload;
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

function getHomeNFTItemRowId(nft: IAccountNFT): string {
  return `${nft.networkId ?? ''}:${nft.collectionAddress}:${nft.itemId}`;
}

function getHomeNFTRowIds(data: IHomeNFTLegacyPayload): readonly string[] {
  return data.data.map(getHomeNFTItemRowId);
}

function createHomeNFTSourceIdentity({
  owner,
  params,
  producerInstanceId,
}: {
  owner: IHomeRuntimeOwnerToken;
  params: IHomeNFTSourceParams;
  producerInstanceId: string;
}): IHomeSectionSourceIdentity {
  const sourceKey = createHomeSourceKey({
    dataSchemaVersion: HOME_NFT_DATA_SCHEMA_VERSION,
    ownerToken: owner,
    paramsFingerprint: stringUtils.stableStringify(params),
    sourceId: 'nft',
  });
  return {
    owner,
    sectionId: 'nft',
    sourceId: 'nft',
    sourceKeyIdentity: getHomeSourceKeyIdentity(sourceKey),
    producerInstanceId,
    sourceRevision: HOME_NFT_SOURCE_REVISION,
  };
}

function adaptHomeNFTSourceSnapshot({
  identity,
  snapshot,
}: {
  identity: IHomeSectionSourceIdentity;
  snapshot: IHomeNFTSourceSnapshot;
}): IHomeSectionCoordinatorEvent<IHomeNFTLegacyPayload> {
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
  HOME_NFT_DATA_SCHEMA_VERSION,
  HOME_NFT_SOURCE_REVISION,
  adaptHomeNFTSourceSnapshot,
  createHomeNFTSourceIdentity,
  getHomeNFTItemRowId,
  getHomeNFTRowIds,
};
export type {
  IHomeNFTLegacyPayload,
  IHomeNFTSourceParams,
  IHomeNFTSourceSnapshot,
};
