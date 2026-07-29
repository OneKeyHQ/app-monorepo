import { useEffect, useMemo } from 'react';

import { useHomeStoreInternalActions } from '@onekeyhq/kit/src/states/jotai/contexts/home/actions';
import {
  type IHomeRuntimeJsonValue,
  type IHomeRuntimeQuoteBasis,
  type IHomeRuntimeRequestToken,
  type IHomeRuntimeSourceResult,
} from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import type { IHomeSectionId } from '../semantic/homeSemanticTypes';
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

type IHomeSectionSourceRequest = {
  ownerToken: {
    scopeKey: string;
    sessionId: string;
  };
  sectionId: IHomeSectionId;
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
  return {
    begin<TSourceId extends IHomeStoreSourceId>(
      request: IHomeStoreSourceRequest<TSourceId>,
    ): IHomeStoreSourceRequestHandle<TSourceId> {
      const snapshot = readHomeStoreSnapshot();
      const token: IHomeStoreRequestToken<TSourceId> = {
        clientInstanceId,
        producerInstanceId:
          snapshot.runtime.producerInstanceId ?? fallbackProducerInstanceId,
        sessionId: request.ownerToken.sessionId,
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
    dispose() {},
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
      priority: result.priority,
      refresh: result.refresh,
    },
  };
}

function createPartialEnvelopeData(
  result: Extract<IHomeStoreSectionSourceResult, { kind: 'partial' }>,
): IHomeRuntimeJsonValue {
  return {
    payload: result.data,
    section: { kind: 'loading' },
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
  const getProducerInstanceId = () => {
    const snapshot = readHomeStoreSnapshot();
    return snapshot.runtime.producerInstanceId ?? fallbackProducerInstanceId;
  };

  const openRequest = (payload: IHomeSectionSourceRequest) => {
    const token: IHomeRuntimeRequestToken = {
      clientInstanceId,
      producerInstanceId: getProducerInstanceId(),
      sessionId: payload.ownerToken.sessionId,
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
    dispatchHomeEvent({ type: 'sourceRequested', token });
    return token;
  };

  const respond = (
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
  };

  const completeRequest = (
    handle: IHomeSectionSourceRequestHandle,
    result: IHomeStoreSectionSourceResult,
  ) => {
    const payload = handle.payload;
    if (result.kind === 'partial') {
      respond(handle.token, {
        kind: 'partial',
        data: createPartialEnvelopeData(result),
        coverageFingerprint: result.coverageFingerprint,
      });
      return;
    }
    if (result.kind === 'ready') {
      respond(handle.token, {
        kind: 'success',
        data: createReadyEnvelopeData(result),
        coverageFingerprint: stringUtils.stableStringify(result.rowIds),
      });
      return;
    }
    if (result.kind === 'empty') {
      respond(handle.token, {
        kind: 'empty',
        coverageFingerprint: `${payload.sectionId}:empty`,
      });
      return;
    }
    if (result.kind === 'error') {
      respond(handle.token, {
        kind: 'error',
        errorKind: 'source',
      });
      return;
    }
    if (result.kind === 'loading') {
      return;
    }
    respond(handle.token, {
      kind: 'hidden',
      reason: result.reason,
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
    dispose() {},
  };
}

export function useHomeStoreSourcePublisher() {
  const actions = useHomeStoreInternalActions();

  const publisher = useMemo(() => {
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
      dispose() {
        sectionGateway.dispose();
        sourceGateway.dispose();
      },
    };
  }, [actions]);

  useEffect(
    () => () => {
      publisher.dispose();
    },
    [publisher],
  );

  return publisher;
}
