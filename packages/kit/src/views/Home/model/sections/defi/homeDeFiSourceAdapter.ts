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

const HOME_DEFI_SOURCE_REVISION = 2;
const HOME_DEFI_DATA_SCHEMA_VERSION = 2;

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
  currency: string;
  overview: {
    totalValue: number;
    totalDebt: number;
    totalReward: number;
    netWorth: number;
  };
  protocolMap: Record<string, IProtocolSummary>;
  protocols: IDeFiProtocol[];
  supportedActions: IDeFiSupportedProtocolAction[];
};

const HOME_DEFI_SNAPSHOT_KEYS = [
  'currency',
  'overview',
  'protocolMap',
  'protocols',
  'supportedActions',
] as const satisfies readonly (keyof IHomeDeFiLegacyPayload)[];

function createHomeDeFiSnapshotDefaults(): IHomeDeFiLegacyPayload {
  return {
    currency: '',
    overview: {
      totalValue: 0,
      totalDebt: 0,
      totalReward: 0,
      netWorth: 0,
    },
    protocolMap: {},
    protocols: [],
    supportedActions: [],
  };
}

type IHomeDeFiSourceSnapshot =
  | { kind: 'loading' }
  | {
      kind: 'confirmedCache';
      data: IHomeDeFiLegacyPayload;
      rowIds: readonly string[];
      refresh: 'idle' | 'refreshing';
    }
  | {
      kind: 'partial';
      coverageFingerprint: string;
      data: IHomeDeFiLegacyPayload;
    }
  | {
      kind: 'complete';
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
      errorKind:
        | 'source'
        | 'transport'
        | 'schemaMismatch'
        | 'runtimeUnavailable';
    };

function getHomeDeFiProtocolRowIds(
  data: Pick<IHomeDeFiLegacyPayload, 'protocols'>,
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
      return { ...identity, kind: 'loading' };
    case 'confirmedCache':
      return createHomeSectionConfirmedSeed({
        data: snapshot.data,
        getRowIds: () => snapshot.rowIds,
        identity,
        refresh: snapshot.refresh,
      });
    case 'partial':
      return {
        ...identity,
        kind: snapshot.kind,
      };
    case 'complete':
      return { ...identity, kind: 'complete', result: snapshot.result };
    case 'error':
      return { ...identity, kind: 'error' };
    default:
      return { ...identity, kind: 'loading' };
  }
}

export {
  HOME_DEFI_DATA_SCHEMA_VERSION,
  HOME_DEFI_SNAPSHOT_KEYS,
  HOME_DEFI_SOURCE_REVISION,
  adaptHomeDeFiSourceSnapshot,
  createHomeDeFiSnapshotDefaults,
  createHomeDeFiSourceIdentity,
  getHomeDeFiProtocolRowIds,
};
export type {
  IHomeDeFiLegacyPayload,
  IHomeDeFiSourceParams,
  IHomeDeFiSourceSnapshot,
};
