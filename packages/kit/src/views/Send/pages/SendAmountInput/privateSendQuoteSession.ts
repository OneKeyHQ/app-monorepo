import { buildSwapQuoteExecutionFingerprint } from '@onekeyhq/kit/src/states/jotai/contexts/swap/quoteSessionV2';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type {
  ICancelSwapQuoteEventsV2Params,
  IFetchSwapQuoteParams,
  ISwapQuoteEventData,
  ISwapQuoteSessionEventV2,
  ISwapQuoteSessionIdentity,
  ISwapQuoteSessionStartResult,
} from '@onekeyhq/shared/types/swap/types';

export type IPrivateSendQuoteSessionState = {
  session: ISwapQuoteSessionIdentity;
  bgGeneration?: number;
  lastSequence: number;
  terminal: boolean;
};

type IPrivateSendQuoteSessionTransition = {
  accepted: boolean;
  state: IPrivateSendQuoteSessionState;
};

function isSamePrivateSendQuoteSession(
  current: ISwapQuoteSessionIdentity,
  incoming: ISwapQuoteSessionIdentity,
) {
  return (
    current.surfaceId === incoming.surfaceId &&
    current.requestId === incoming.requestId &&
    current.fingerprint === incoming.fingerprint &&
    current.intentRevision === incoming.intentRevision
  );
}

export function buildPrivateSendQuoteSurfaceId({
  componentInstanceId,
  nodeId,
}: {
  componentInstanceId: string;
  nodeId: string;
}) {
  return `${nodeId}:private-send:${componentInstanceId}`;
}

export function createPrivateSendQuoteSessionState({
  intentRevision,
  request,
  requestId = generateUUID(),
  surfaceId,
}: {
  intentRevision: number;
  request: IFetchSwapQuoteParams;
  requestId?: string;
  surfaceId: string;
}): IPrivateSendQuoteSessionState {
  return {
    session: {
      surfaceId,
      requestId,
      fingerprint: buildSwapQuoteExecutionFingerprint(request),
      intentRevision,
    },
    lastSequence: 0,
    terminal: false,
  };
}

export function buildPrivateSendQuoteCancelParams(
  session: ISwapQuoteSessionIdentity,
): ICancelSwapQuoteEventsV2Params {
  return {
    surfaceId: session.surfaceId,
    requestId: session.requestId,
  };
}

export function acceptPrivateSendQuoteSessionStartResult({
  result,
  state,
}: {
  result: ISwapQuoteSessionStartResult;
  state: IPrivateSendQuoteSessionState;
}): IPrivateSendQuoteSessionTransition {
  if (
    state.terminal ||
    !isSamePrivateSendQuoteSession(state.session, result.session) ||
    (state.bgGeneration !== undefined &&
      state.bgGeneration !== result.bgGeneration)
  ) {
    return { accepted: false, state };
  }

  return {
    accepted: true,
    state: {
      ...state,
      bgGeneration: result.bgGeneration,
      terminal: !result.accepted,
    },
  };
}

export function acceptPrivateSendQuoteSessionEvent({
  event,
  paramsMatched,
  state,
}: {
  event: ISwapQuoteSessionEventV2;
  paramsMatched: boolean;
  state: IPrivateSendQuoteSessionState;
}): IPrivateSendQuoteSessionTransition {
  if (
    state.terminal ||
    !paramsMatched ||
    !isSamePrivateSendQuoteSession(state.session, event.session) ||
    (state.bgGeneration !== undefined &&
      state.bgGeneration !== event.bgGeneration) ||
    event.sequence <= state.lastSequence
  ) {
    return { accepted: false, state };
  }

  return {
    accepted: true,
    state: {
      ...state,
      bgGeneration: event.bgGeneration,
      lastSequence: event.sequence,
      terminal:
        event.kind === 'done' ||
        event.kind === 'transportError' ||
        event.kind === 'cancelled',
    },
  };
}

export function parsePrivateSendQuoteEventDataSafe(
  data: string | null | undefined,
): ISwapQuoteEventData | undefined {
  if (!data) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(data) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return undefined;
    }
    return parsed as ISwapQuoteEventData;
  } catch {
    return undefined;
  }
}
