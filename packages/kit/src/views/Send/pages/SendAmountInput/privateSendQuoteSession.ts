import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { buildSwapQuoteExecutionFingerprint } from '@onekeyhq/shared/src/utils/swapQuoteFingerprint';
import {
  isSameSwapTokenIdentity,
  isValidSwapTokenIdentity,
} from '@onekeyhq/shared/src/utils/swapTokenIdentity';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { privateSendProvider } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ICancelSwapQuoteEventsV2Params,
  IFetchQuoteResult,
  IFetchSwapQuoteParams,
  ISwapQuoteEventAutoSlippage,
  ISwapQuoteEventData,
  ISwapQuoteSessionEventV2,
  ISwapQuoteSessionIdentity,
  ISwapQuoteSessionStartResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

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

export function isPrivateSendQuoteTokenValid(
  token?: ISwapToken,
): token is ISwapToken {
  return isValidSwapTokenIdentity(token);
}

export function isPrivateSendProviderQuote(
  quote?: Pick<IFetchQuoteResult, 'info'>,
) {
  // providerName is display metadata and may be localized or branded by the
  // server. The stable provider id is the execution-routing identity.
  return quote?.info.provider === privateSendProvider;
}

function applyPrivateSendAutoSlippage({
  quote,
  autoSlippage,
}: {
  quote: IFetchQuoteResult;
  autoSlippage?: ISwapQuoteEventAutoSlippage;
}) {
  // Auto-slippage events expose only network/address fields, so this coarse
  // match cannot infer isNative. normalizePrivateSendQuoteEventResults then
  // applies the full session token identity and eventId before publication.
  if (
    !autoSlippage ||
    quote.autoSuggestedSlippage ||
    quote.eventId !== autoSlippage.eventId ||
    !equalTokenNoCaseSensitive({
      token1: quote.fromTokenInfo,
      token2: {
        networkId: autoSlippage.fromNetworkId,
        contractAddress: autoSlippage.fromTokenAddress,
      },
    }) ||
    !equalTokenNoCaseSensitive({
      token1: quote.toTokenInfo,
      token2: {
        networkId: autoSlippage.toNetworkId,
        contractAddress: autoSlippage.toTokenAddress,
      },
    })
  ) {
    return quote;
  }
  return {
    ...quote,
    autoSuggestedSlippage: autoSlippage.autoSuggestedSlippage,
  };
}

export function normalizePrivateSendQuoteEventResults({
  quotes,
  request,
  eventId,
  autoSlippage,
}: {
  quotes: IFetchQuoteResult[];
  request: Pick<IFetchSwapQuoteParams, 'fromToken' | 'toToken'>;
  eventId?: string;
  autoSlippage?: ISwapQuoteEventAutoSlippage;
}) {
  return quotes
    .map((quote) => applyPrivateSendAutoSlippage({ quote, autoSlippage }))
    .filter(
      (quote) =>
        isPrivateSendProviderQuote(quote) &&
        quote.protocol === EProtocolOfExchange.PRIVATE_SEND &&
        (!eventId || quote.eventId === eventId) &&
        isSameSwapTokenIdentity({
          token1: quote.fromTokenInfo,
          token2: request.fromToken,
        }) &&
        isSameSwapTokenIdentity({
          token1: quote.toTokenInfo,
          token2: request.toToken,
        }),
    );
}

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
