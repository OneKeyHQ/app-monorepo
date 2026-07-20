import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';
import type { IPerpsHomeView } from '@onekeyhq/shared/src/utils/perpsHomeViewUtils';
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

const HOME_PERPS_SOURCE_REVISION = 1;
const HOME_PERPS_DATA_SCHEMA_VERSION = 1;

type IHomePerpsSourceParams = {
  accountScopeKey: string;
  accountId: string;
  deriveType: string;
  indexedAccountId: string;
  networkId: string;
};

type IHomePerpsLegacyPayload = {
  address: string;
  scopeKey: string | undefined;
  view: IPerpsHomeView;
};

type IHomePerpsSourceSnapshot =
  | { kind: 'loading'; requestSeq: number }
  | {
      kind: 'confirmedCache';
      requestSeq: number;
      data: IHomePerpsLegacyPayload;
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
            data: IHomePerpsLegacyPayload;
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

function createHomePerpsSourceIdentity({
  owner,
  params,
  producerInstanceId,
}: {
  owner: IHomeRuntimeOwnerToken;
  params: IHomePerpsSourceParams;
  producerInstanceId: string;
}): IHomeSectionSourceIdentity {
  const sourceKey = createHomeSourceKey({
    dataSchemaVersion: HOME_PERPS_DATA_SCHEMA_VERSION,
    ownerToken: owner,
    paramsFingerprint: stringUtils.stableStringify(params),
    sourceId: 'perps',
  });
  return {
    owner,
    sectionId: 'perps',
    sourceId: 'perps',
    sourceKeyIdentity: getHomeSourceKeyIdentity(sourceKey),
    producerInstanceId,
    sourceRevision: HOME_PERPS_SOURCE_REVISION,
  };
}

function adaptHomePerpsSourceSnapshot({
  identity,
  snapshot,
}: {
  identity: IHomeSectionSourceIdentity;
  snapshot: IHomePerpsSourceSnapshot;
}): IHomeSectionCoordinatorEvent<IHomePerpsLegacyPayload> {
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
  HOME_PERPS_DATA_SCHEMA_VERSION,
  HOME_PERPS_SOURCE_REVISION,
  adaptHomePerpsSourceSnapshot,
  createHomePerpsSourceIdentity,
};
export type {
  IHomePerpsLegacyPayload,
  IHomePerpsSourceParams,
  IHomePerpsSourceSnapshot,
};
