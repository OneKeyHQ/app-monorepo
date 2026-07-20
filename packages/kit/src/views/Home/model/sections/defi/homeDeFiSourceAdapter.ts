import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  IDeFiProtocol,
  IDeFiSupportedProtocolAction,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import {
  createHomeSourceKey,
  getHomeSourceKeyIdentity,
} from '../../core/homeIdentity';
import { createHomeSectionConfirmedSeed } from '../homeSectionSourceAdapter';

import type {
  IHomeSectionCoordinatorEvent,
  IHomeSectionSourceIdentity,
} from '../homeSectionCoordinator';

const HOME_DEFI_SOURCE_REVISION = 1;
const HOME_DEFI_DATA_SCHEMA_VERSION = 1;

type IHomeDeFiSourceParams = {
  accountId: string;
  indexedAccountId: string | undefined;
  networkId: string;
  walletId: string;
  networkMode: 'allNetworks' | 'singleNetwork';
  sourceCurrencyId: string | undefined;
  targetCurrencyId: string | undefined;
};

type IHomeDeFiLegacyPayload = {
  protocolMap: Record<string, IProtocolSummary>;
  protocols: IDeFiProtocol[];
  supportedActions: IDeFiSupportedProtocolAction[];
};

type IHomeDeFiSourceSnapshot =
  | { kind: 'loading'; requestSeq: number }
  | {
      kind: 'confirmedCache';
      requestSeq: number;
      data: IHomeDeFiLegacyPayload;
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
            data: IHomeDeFiLegacyPayload;
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

function getHomeDeFiProtocolRowIds(
  data: IHomeDeFiLegacyPayload,
): readonly string[] {
  return data.protocols.map((protocol) =>
    defiUtils.buildProtocolMapKey({
      networkId: protocol.networkId,
      protocol: protocol.protocol,
    }),
  );
}

function createHomeDeFiSourceIdentity({
  owner,
  params,
  producerInstanceId,
}: {
  owner: IHomeRuntimeOwnerToken;
  params: IHomeDeFiSourceParams;
  producerInstanceId: string;
}): IHomeSectionSourceIdentity {
  const sourceKey = createHomeSourceKey({
    dataSchemaVersion: HOME_DEFI_DATA_SCHEMA_VERSION,
    ownerToken: owner,
    paramsFingerprint: stringUtils.stableStringify(params),
    sourceId: 'defi',
  });
  return {
    owner,
    sectionId: 'defi',
    sourceId: 'defi',
    sourceKeyIdentity: getHomeSourceKeyIdentity(sourceKey),
    producerInstanceId,
    sourceRevision: HOME_DEFI_SOURCE_REVISION,
  };
}

function adaptHomeDeFiSourceSnapshot({
  identity,
  snapshot,
}: {
  identity: IHomeSectionSourceIdentity;
  snapshot: IHomeDeFiSourceSnapshot;
}): IHomeSectionCoordinatorEvent<IHomeDeFiLegacyPayload> {
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
  HOME_DEFI_DATA_SCHEMA_VERSION,
  HOME_DEFI_SOURCE_REVISION,
  adaptHomeDeFiSourceSnapshot,
  createHomeDeFiSourceIdentity,
  getHomeDeFiProtocolRowIds,
};
export type {
  IHomeDeFiLegacyPayload,
  IHomeDeFiSourceParams,
  IHomeDeFiSourceSnapshot,
};
