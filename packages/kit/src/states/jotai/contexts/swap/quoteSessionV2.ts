import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import {
  buildSwapQuoteDisplayIntentFingerprint,
  buildSwapQuoteExecutionFingerprint,
} from '@onekeyhq/shared/src/utils/swapQuoteFingerprint';
import type {
  IFetchSwapQuoteParams,
  ISwapQuoteEventData,
  ISwapQuoteSessionEventV2,
  ISwapQuoteSessionIdentity,
  ISwapQuoteSessionStartResult,
} from '@onekeyhq/shared/types/swap/types';

export {
  buildSwapQuoteDisplayIntentFingerprint,
  buildSwapQuoteExecutionFingerprint,
};

export type ISwapQuoteSessionPhase =
  | 'idle'
  | 'preparing'
  | 'streaming'
  | 'settled'
  | 'cancelled'
  | 'error';

export type ISwapQuoteSessionState = {
  surfaceId?: string;
  intentRevision: number;
  activeSession?: ISwapQuoteSessionIdentity;
  bgGeneration?: number;
  lastSequence: number;
  phase: ISwapQuoteSessionPhase;
};

type IPreparedSwapQuoteSessionState = ISwapQuoteSessionState & {
  surfaceId: string;
  activeSession: ISwapQuoteSessionIdentity;
};

export const SWAP_QUOTE_SESSION_V2_INITIAL_STATE: ISwapQuoteSessionState = {
  intentRevision: 0,
  lastSequence: 0,
  phase: 'idle',
};

type ISwapQuoteSessionTransition = {
  accepted: boolean;
  state: ISwapQuoteSessionState;
};

function isSameSessionIdentity(
  left: ISwapQuoteSessionIdentity | undefined,
  right: ISwapQuoteSessionIdentity,
) {
  return (
    left?.surfaceId === right.surfaceId &&
    left.requestId === right.requestId &&
    left.fingerprint === right.fingerprint &&
    left.intentRevision === right.intentRevision
  );
}

export function isSwapQuoteSessionEventForCurrentSession({
  event,
  state,
}: {
  event: ISwapQuoteSessionEventV2;
  state: ISwapQuoteSessionState;
}) {
  return (
    isSameSessionIdentity(state.activeSession, event.session) &&
    (state.bgGeneration === undefined ||
      state.bgGeneration === event.bgGeneration)
  );
}

function buildSwapQuoteSurfaceId() {
  return `${appEventBus.nodeId}:swap:${generateUUID()}`;
}

export function prepareSwapQuoteSession({
  intentRevision,
  request,
  state,
}: {
  intentRevision?: number;
  request: IFetchSwapQuoteParams;
  state: ISwapQuoteSessionState;
}): IPreparedSwapQuoteSessionState {
  const surfaceId = state.surfaceId ?? buildSwapQuoteSurfaceId();
  const nextIntentRevision = intentRevision ?? state.intentRevision + 1;
  return {
    surfaceId,
    intentRevision: nextIntentRevision,
    activeSession: {
      surfaceId,
      requestId: generateUUID(),
      fingerprint: buildSwapQuoteExecutionFingerprint(request),
      intentRevision: nextIntentRevision,
    },
    bgGeneration: undefined,
    lastSequence: 0,
    phase: 'preparing',
  };
}

export function invalidateSwapQuoteSession(
  state: ISwapQuoteSessionState,
): ISwapQuoteSessionState {
  return {
    ...state,
    intentRevision: state.intentRevision + 1,
    activeSession: undefined,
    bgGeneration: undefined,
    lastSequence: 0,
    phase: 'cancelled',
  };
}

export function applySwapQuoteSessionStartResult({
  result,
  state,
}: {
  result: ISwapQuoteSessionStartResult;
  state: ISwapQuoteSessionState;
}): ISwapQuoteSessionTransition {
  if (!isSameSessionIdentity(state.activeSession, result.session)) {
    return { accepted: false, state };
  }
  if (
    state.bgGeneration !== undefined &&
    state.bgGeneration !== result.bgGeneration
  ) {
    return { accepted: false, state };
  }
  const isTerminalPhase =
    state.phase === 'settled' ||
    state.phase === 'cancelled' ||
    state.phase === 'error';
  let phase: ISwapQuoteSessionPhase = state.phase;
  if (!isTerminalPhase) {
    phase = result.accepted ? 'streaming' : 'cancelled';
  }
  return {
    accepted: true,
    state: {
      ...state,
      bgGeneration: result.bgGeneration,
      phase,
    },
  };
}

export function acceptSwapQuoteSessionEvent({
  event,
  state,
}: {
  event: ISwapQuoteSessionEventV2;
  state: ISwapQuoteSessionState;
}): ISwapQuoteSessionTransition {
  if (
    state.phase === 'settled' ||
    state.phase === 'cancelled' ||
    state.phase === 'error'
  ) {
    return { accepted: false, state };
  }
  if (!isSameSessionIdentity(state.activeSession, event.session)) {
    return { accepted: false, state };
  }
  if (
    state.bgGeneration !== undefined &&
    state.bgGeneration !== event.bgGeneration
  ) {
    return { accepted: false, state };
  }
  if (event.sequence <= state.lastSequence) {
    return { accepted: false, state };
  }

  let phase: ISwapQuoteSessionPhase = 'streaming';
  if (event.kind === 'done') {
    phase = 'settled';
  } else if (event.kind === 'cancelled') {
    phase = 'cancelled';
  } else if (event.kind === 'transportError') {
    phase = 'error';
  }

  return {
    accepted: true,
    state: {
      ...state,
      bgGeneration: event.bgGeneration,
      lastSequence: event.sequence,
      phase,
    },
  };
}

export function parseSwapQuoteEventDataSafe(
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
