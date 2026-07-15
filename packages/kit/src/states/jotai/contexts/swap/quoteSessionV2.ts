import { sha256 as sha256ByNoble } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  IFetchSwapQuoteParams,
  ISwapQuoteEventData,
  ISwapQuoteSessionEventV2,
  ISwapQuoteSessionIdentity,
  ISwapQuoteSessionStartResult,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapQuoteKind } from '@onekeyhq/shared/types/swap/types';

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

function encodeUtf8(value: string) {
  const encoded = encodeURIComponent(value);
  const bytes: number[] = [];
  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] === '%') {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(encoded.charCodeAt(index));
    }
  }
  return Uint8Array.from(bytes);
}

export function buildSwapQuoteSurfaceId() {
  return `${appEventBus.nodeId}:swap:${generateUUID()}`;
}

function buildSwapQuoteCanonicalRequest(
  request: IFetchSwapQuoteParams,
  slippage: unknown,
  {
    includeBlockNumber,
    includeInactiveAmount,
  }: {
    includeBlockNumber: boolean;
    includeInactiveAmount: boolean;
  },
) {
  const kind = request.kind ?? ESwapQuoteKind.SELL;
  return {
    protocol: request.protocol,
    kind,
    fromToken: {
      networkId: request.fromToken.networkId,
      contractAddress: request.fromToken.contractAddress,
    },
    toToken: {
      networkId: request.toToken.networkId,
      contractAddress: request.toToken.contractAddress,
    },
    fromTokenAmount:
      includeInactiveAmount || kind === ESwapQuoteKind.SELL
        ? request.fromTokenAmount
        : undefined,
    toTokenAmount:
      includeInactiveAmount || kind === ESwapQuoteKind.BUY
        ? request.toTokenAmount
        : undefined,
    accountId: request.accountId,
    userAddress: request.userAddress,
    receivingAddress: request.receivingAddress,
    slippage,
    ...(includeBlockNumber ? { blockNumber: request.blockNumber } : {}),
    expirationTime: request.expirationTime,
    limitPartiallyFillable: request.limitPartiallyFillable,
    userMarketPriceRate: request.userMarketPriceRate,
    incognito: request.incognito,
  };
}

function hashSwapQuoteCanonicalRequest(canonicalRequest: unknown) {
  const serialized = stableStringify(canonicalRequest);
  return bytesToHex(sha256ByNoble(encodeUtf8(serialized)));
}

export function buildSwapQuoteExecutionFingerprint(
  request: IFetchSwapQuoteParams,
) {
  return hashSwapQuoteCanonicalRequest(
    buildSwapQuoteCanonicalRequest(
      request,
      {
        autoSlippage: request.autoSlippage,
        percentage: request.slippagePercentage,
      },
      { includeBlockNumber: true, includeInactiveAmount: true },
    ),
  );
}

/**
 * Display ownership follows the user's slippage mode. Backend AUTO
 * suggestions may change the concrete percentage between refreshes, but that
 * must not erase the last committed amount. Execution ownership continues to
 * use the exact fingerprint above and is revoked for every new request.
 */
export function buildSwapQuoteDisplayIntentFingerprint(
  request: IFetchSwapQuoteParams,
) {
  return hashSwapQuoteCanonicalRequest(
    buildSwapQuoteCanonicalRequest(
      request,
      request.autoSlippage
        ? { autoSlippage: true }
        : {
            autoSlippage: false,
            percentage: request.slippagePercentage,
          },
      { includeBlockNumber: false, includeInactiveAmount: false },
    ),
  );
}

export function prepareSwapQuoteSession({
  intentRevision,
  request,
  state,
}: {
  intentRevision?: number;
  request: IFetchSwapQuoteParams;
  state: ISwapQuoteSessionState;
}): ISwapQuoteSessionState {
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
