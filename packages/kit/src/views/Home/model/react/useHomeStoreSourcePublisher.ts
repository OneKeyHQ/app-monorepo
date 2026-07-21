import { useMemo } from 'react';

import { useHomeStoreInternalActions } from '@onekeyhq/kit/src/states/jotai/contexts/home/actions';
import {
  HOME_RUNTIME_PROTOCOL_VERSION,
  type IHomeRuntimeJsonValue,
  type IHomeRuntimeQuoteBasis,
  type IHomeRuntimeRequestToken,
  type IHomeRuntimeSourceResult,
} from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import type {
  IHomeStoreEvent,
  IHomeStoreRequestToken,
  IHomeStoreSectionSourceResult,
  IHomeStoreSourceId,
  IHomeStoreSourcePayloadMap,
  IHomeStoreState,
} from '../store/homeStoreTypes';

type IHomeSourceEventPayload<TType extends IHomeStoreEvent['type']> = Omit<
  Extract<IHomeStoreEvent, { type: TType }>,
  'type'
>;

type IHomeSectionSourceRequest = Omit<
  IHomeSourceEventPayload<'sectionSourceChanged'>,
  'result'
> & {
  dataSchemaVersion?: number;
  paramsFingerprint?: string;
  quoteBasis?: IHomeRuntimeQuoteBasis;
};

export type IHomeSectionSourceRequestHandle = {
  payload: IHomeSectionSourceRequest;
  token: IHomeRuntimeRequestToken;
};

type IHomeStoreSectionSourceGatewayOptions = {
  clientInstanceId?: string;
  fallbackProducerInstanceId?: string;
  dispatchHomeEvent: (event: IHomeStoreEvent) => unknown;
  readHomeStoreSnapshot: () => IHomeStoreState;
};

export type IHomeStoreSourceRequest<TSourceId extends IHomeStoreSourceId> = {
  ownerToken: {
    scopeKey: string;
    sessionId: string;
  };
  sourceId: TSourceId;
  paramsFingerprint?: string;
  dataSchemaVersion?: number;
  quoteBasis?: IHomeRuntimeQuoteBasis;
};

export type IHomeStoreSourceRequestHandle<
  TSourceId extends IHomeStoreSourceId,
> = {
  request: IHomeStoreSourceRequest<TSourceId>;
  token: IHomeStoreRequestToken<TSourceId>;
};

let homeSourceGatewayInstanceSeq = 0;

function createHomeSourceGatewayInstanceId(prefix: string) {
  homeSourceGatewayInstanceSeq += 1;
  return `${prefix}:${Date.now()}:${homeSourceGatewayInstanceSeq}`;
}

export function createHomeStoreSourceGateway({
  clientInstanceId = createHomeSourceGatewayInstanceId(
    'home-resource-source-client',
  ),
  dispatchHomeEvent,
  fallbackProducerInstanceId = createHomeSourceGatewayInstanceId(
    'home-resource-source-producer',
  ),
  readHomeStoreSnapshot,
}: IHomeStoreSectionSourceGatewayOptions) {
  const requestSeqBySource = new Map<string, number>();

  return {
    begin<TSourceId extends IHomeStoreSourceId>(
      request: IHomeStoreSourceRequest<TSourceId>,
    ): IHomeStoreSourceRequestHandle<TSourceId> {
      const snapshot = readHomeStoreSnapshot();
      const sourceIdentity = `${request.ownerToken.scopeKey}:${request.ownerToken.sessionId}:${request.sourceId}`;
      const current = snapshot.resources[request.sourceId];
      const currentRequestSeq =
        current.kind === 'idle' ? 0 : (current.token?.requestSeq ?? 0);
      const requestSeq =
        Math.max(
          currentRequestSeq,
          requestSeqBySource.get(sourceIdentity) ?? 0,
        ) + 1;
      requestSeqBySource.set(sourceIdentity, requestSeq);
      const token: IHomeStoreRequestToken<TSourceId> = {
        protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
        clientInstanceId,
        producerInstanceId:
          snapshot.runtime.producerInstanceId ?? fallbackProducerInstanceId,
        sessionId: request.ownerToken.sessionId,
        requestSeq,
        sourceKey: {
          scopeKey: request.ownerToken.scopeKey,
          sourceId: request.sourceId,
          paramsFingerprint: stringUtils.stableStringify({
            ownerScopeKey: request.ownerToken.scopeKey,
            params: request.paramsFingerprint ?? null,
            sourceId: request.sourceId,
          }),
          dataSchemaVersion: request.dataSchemaVersion ?? 1,
          quoteBasis: request.quoteBasis,
        },
      };
      dispatchHomeEvent({ type: 'sourceRequested', token });
      return { request, token };
    },
    complete<TSourceId extends IHomeStoreSourceId>(
      handle: IHomeStoreSourceRequestHandle<TSourceId>,
      result: IHomeRuntimeSourceResult<IHomeStoreSourcePayloadMap[TSourceId]>,
    ) {
      dispatchHomeEvent({
        type: 'sourceResponded',
        envelope: { token: handle.token, result },
      } as IHomeStoreEvent);
    },
  };
}

function createReadyEnvelopeData(
  result: Extract<IHomeStoreSectionSourceResult, { kind: 'ready' }>,
): IHomeRuntimeJsonValue {
  return {
    payload: result.data ?? null,
    section: {
      kind: 'ready',
      rowIds: result.rowIds,
      freshness: result.freshness,
      refresh: result.refresh,
    },
  };
}

export function createHomeStoreSectionSourceGateway({
  clientInstanceId = createHomeSourceGatewayInstanceId('home-source-client'),
  dispatchHomeEvent,
  fallbackProducerInstanceId = createHomeSourceGatewayInstanceId(
    'home-source-producer',
  ),
  readHomeStoreSnapshot,
}: IHomeStoreSectionSourceGatewayOptions) {
  const activeTokenBySource = new Map<string, IHomeRuntimeRequestToken>();
  const requestSeqBySource = new Map<string, number>();

  const getLifecycle = (payload: IHomeSectionSourceRequest) => {
    const snapshot = readHomeStoreSnapshot();
    const producerInstanceId =
      snapshot.runtime.producerInstanceId ?? fallbackProducerInstanceId;
    const sourceIdentity = `${payload.ownerToken.scopeKey}:${payload.ownerToken.sessionId}:${payload.sectionId}`;
    return { producerInstanceId, snapshot, sourceIdentity };
  };

  const openRequest = (payload: IHomeSectionSourceRequest) => {
    const { producerInstanceId, snapshot, sourceIdentity } =
      getLifecycle(payload);
    const currentResource = snapshot.resources[payload.sectionId];
    const currentStoreRequestSeq =
      currentResource.kind === 'idle'
        ? 0
        : (currentResource.token?.requestSeq ?? 0);
    const requestSeq =
      Math.max(
        requestSeqBySource.get(sourceIdentity) ?? 0,
        currentStoreRequestSeq,
      ) + 1;
    requestSeqBySource.set(sourceIdentity, requestSeq);
    const token: IHomeRuntimeRequestToken = {
      protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
      clientInstanceId,
      producerInstanceId,
      sessionId: payload.ownerToken.sessionId,
      requestSeq,
      sourceKey: {
        scopeKey: payload.ownerToken.scopeKey,
        sourceId: payload.sectionId,
        paramsFingerprint: stringUtils.stableStringify({
          ownerScopeKey: payload.ownerToken.scopeKey,
          params:
            'paramsFingerprint' in payload
              ? (payload.paramsFingerprint ?? null)
              : null,
          sectionId: payload.sectionId,
        }),
        dataSchemaVersion: payload.dataSchemaVersion ?? 1,
        quoteBasis: payload.quoteBasis,
      },
    };
    activeTokenBySource.set(sourceIdentity, token);
    dispatchHomeEvent({ type: 'sourceRequested', token });
    return token;
  };

  const respond = (
    payload: IHomeSectionSourceRequest,
    token: IHomeRuntimeRequestToken,
    result: Extract<
      IHomeStoreEvent,
      { type: 'sourceResponded' }
    >['envelope']['result'],
  ) => {
    dispatchHomeEvent({
      type: 'sourceResponded',
      envelope: { token, result },
    });
    const { sourceIdentity } = getLifecycle(payload);
    if (activeTokenBySource.get(sourceIdentity) === token) {
      activeTokenBySource.delete(sourceIdentity);
    }
  };

  const completeRequest = (
    handle: IHomeSectionSourceRequestHandle,
    result: IHomeStoreSectionSourceResult,
  ) => {
    const payload = handle.payload;
    if (result.kind === 'ready') {
      respond(payload, handle.token, {
        kind: 'success',
        data: createReadyEnvelopeData(result),
        coverageFingerprint: stringUtils.stableStringify(result.rowIds),
      });
      return;
    }
    if (result.kind === 'empty') {
      respond(payload, handle.token, {
        kind: 'empty',
        coverageFingerprint: `${payload.sectionId}:empty`,
      });
      return;
    }
    if (result.kind === 'error') {
      respond(payload, handle.token, {
        kind: 'error',
        errorKind: 'source',
      });
      return;
    }
    if (result.kind === 'loading') {
      return;
    }
    dispatchHomeEvent({
      type: 'sectionSourceChanged',
      ...payload,
      result,
    });
  };

  return {
    begin(payload: IHomeSectionSourceRequest): IHomeSectionSourceRequestHandle {
      return {
        payload,
        token: openRequest(payload),
      };
    },
    complete: completeRequest,
  };
}

export function useHomeStoreSourcePublisher() {
  const actions = useHomeStoreInternalActions();

  return useMemo(() => {
    const sectionGateway = createHomeStoreSectionSourceGateway({
      dispatchHomeEvent: (event) => actions.current.dispatchHomeEvent(event),
      readHomeStoreSnapshot: () => actions.current.readHomeStoreSnapshot(),
    });
    const sourceGateway = createHomeStoreSourceGateway({
      dispatchHomeEvent: (event) => actions.current.dispatchHomeEvent(event),
      readHomeStoreSnapshot: () => actions.current.readHomeStoreSnapshot(),
    });
    return {
      beginHomeSourceRequest: <TSourceId extends IHomeStoreSourceId>(
        request: IHomeStoreSourceRequest<TSourceId>,
      ) => sourceGateway.begin(request),
      completeHomeSourceRequest: <TSourceId extends IHomeStoreSourceId>(
        handle: IHomeStoreSourceRequestHandle<TSourceId>,
        result: IHomeRuntimeSourceResult<IHomeStoreSourcePayloadMap[TSourceId]>,
      ) => sourceGateway.complete(handle, result),
      beginHomeSectionRequest: (payload: IHomeSectionSourceRequest) =>
        sectionGateway.begin(payload),
      completeHomeSectionRequest: (
        handle: IHomeSectionSourceRequestHandle,
        result: IHomeStoreSectionSourceResult,
      ) => sectionGateway.complete(handle, result),
      publishHomeBalanceSource: (
        payload: IHomeSourceEventPayload<'balanceChanged'>,
      ) => {
        actions.current.dispatchHomeEvent({
          type: 'balanceChanged',
          ...payload,
        });
      },
      publishHomeCapabilitySource: (
        payload: IHomeSourceEventPayload<'capabilityChanged'>,
      ) => {
        actions.current.dispatchHomeEvent({
          type: 'capabilityChanged',
          ...payload,
        });
      },
      resetHomeSectionSource: (
        payload: IHomeSourceEventPayload<'sectionReset'>,
      ) => {
        actions.current.dispatchHomeEvent({
          type: 'sectionReset',
          ...payload,
        });
      },
    };
  }, [actions]);
}
