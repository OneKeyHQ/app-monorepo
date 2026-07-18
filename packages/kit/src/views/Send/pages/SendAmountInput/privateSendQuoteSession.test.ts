import { privateSendProvider } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
  ESwapTabSwitchType,
  type IFetchQuoteResult,
  type IFetchQuotesParams,
  type IFetchSwapQuoteParams,
  type ISwapQuoteEventAutoSlippage,
  type ISwapQuoteSessionEventV2,
} from '@onekeyhq/shared/types/swap/types';

import {
  acceptPrivateSendQuoteSessionEvent,
  acceptPrivateSendQuoteSessionStartResult,
  buildPrivateSendQuoteCancelParams,
  buildPrivateSendQuoteSurfaceId,
  createPrivateSendQuoteSessionState,
  isPrivateSendProviderQuote,
  isPrivateSendQuoteTokenValid,
  normalizePrivateSendQuoteEventResults,
  parsePrivateSendQuoteEventDataSafe,
} from './privateSendQuoteSession';

const fromToken = {
  networkId: 'btc--0',
  contractAddress: '',
  isNative: true,
  symbol: 'BTC',
  decimals: 8,
};
const toToken = {
  networkId: 'btc--0',
  contractAddress: 'private-btc',
  symbol: 'pBTC',
  decimals: 8,
};
const request: IFetchSwapQuoteParams = {
  fromToken,
  toToken,
  fromTokenAmount: '1',
  userAddress: 'from-address',
  receivingAddress: 'to-address',
  slippagePercentage: 1,
  protocol: ESwapTabSwitchType.PRIVATE_SEND,
  kind: ESwapQuoteKind.SELL,
  accountId: 'account-1',
};
const params: IFetchQuotesParams = {
  fromNetworkId: fromToken.networkId,
  toNetworkId: toToken.networkId,
  fromTokenAddress: fromToken.contractAddress,
  toTokenAddress: toToken.contractAddress,
  fromTokenAmount: request.fromTokenAmount,
  protocol: EProtocolOfExchange.PRIVATE_SEND,
  userAddress: request.userAddress,
  receivingAddress: request.receivingAddress,
  slippagePercentage: request.slippagePercentage,
  kind: request.kind,
};

function buildState({
  intentRevision = 1,
  requestId = 'request-1',
  surfaceId = 'node-1:private-send:instance-1',
}: {
  intentRevision?: number;
  requestId?: string;
  surfaceId?: string;
} = {}) {
  return createPrivateSendQuoteSessionState({
    intentRevision,
    request,
    requestId,
    surfaceId,
  });
}

function buildEvent({
  bgGeneration = 1,
  kind = 'message',
  sequence = 1,
  state = buildState(),
}: {
  bgGeneration?: number;
  kind?: ISwapQuoteSessionEventV2['kind'];
  sequence?: number;
  state?: ReturnType<typeof buildState>;
} = {}): ISwapQuoteSessionEventV2 {
  const base = {
    version: 2 as const,
    session: state.session,
    bgGeneration,
    sequence,
    emittedAt: 1,
    params,
    accountId: request.accountId,
    tokenPairs: { fromToken, toToken },
  };

  if (kind === 'message') {
    return { ...base, kind, data: '{}', lastEventId: null };
  }
  if (kind === 'transportError') {
    return { ...base, kind, error: { message: 'network error' } };
  }
  return { ...base, kind };
}

describe('privateSendQuoteSession', () => {
  it('accepts a native Private Send token and rejects incomplete non-native identity', () => {
    expect(isPrivateSendQuoteTokenValid(fromToken)).toBe(true);
    expect(
      isPrivateSendQuoteTokenValid({ ...fromToken, isNative: false }),
    ).toBe(false);
  });

  it('applies address-only auto slippage only after the full session token pair matches', () => {
    const quote = {
      eventId: 'event-1',
      protocol: EProtocolOfExchange.PRIVATE_SEND,
      info: { provider: privateSendProvider, providerName: 'Provider' },
      fromTokenInfo: fromToken,
      toTokenInfo: toToken,
      fromAmount: '1',
      toAmount: '0.9',
    } as IFetchQuoteResult;
    const autoSlippage = {
      eventId: 'event-1',
      fromNetworkId: fromToken.networkId,
      fromTokenAddress: fromToken.contractAddress,
      toNetworkId: toToken.networkId,
      toTokenAddress: toToken.contractAddress,
      autoSuggestedSlippage: 0.5,
    } as ISwapQuoteEventAutoSlippage;

    expect(
      normalizePrivateSendQuoteEventResults({
        quotes: [quote],
        request,
        eventId: 'event-1',
        autoSlippage,
      })[0]?.autoSuggestedSlippage,
    ).toBe(0.5);
    expect(
      normalizePrivateSendQuoteEventResults({
        quotes: [
          {
            ...quote,
            fromTokenInfo: { ...fromToken, isNative: false },
          },
        ],
        request,
        eventId: 'event-1',
        autoSlippage,
      }),
    ).toEqual([]);
  });

  it('filters quotes from a provider that cannot own the Private Send build', () => {
    const foreignQuote = {
      eventId: 'event-1',
      protocol: EProtocolOfExchange.PRIVATE_SEND,
      info: { provider: 'foreign', providerName: 'Foreign' },
      fromTokenInfo: fromToken,
      toTokenInfo: toToken,
      fromAmount: '1',
      toAmount: '0.9',
    } as IFetchQuoteResult;

    expect(isPrivateSendProviderQuote(foreignQuote)).toBe(false);
    expect(
      normalizePrivateSendQuoteEventResults({
        quotes: [foreignQuote],
        request,
        eventId: 'event-1',
      }),
    ).toEqual([]);
  });

  it('builds a stable surface id from the runtime node and component instance', () => {
    expect(
      buildPrivateSendQuoteSurfaceId({
        nodeId: 'node-1',
        componentInstanceId: 'instance-1',
      }),
    ).toBe('node-1:private-send:instance-1');
  });

  it('creates a unique request id and monotonic revision with a deterministic fingerprint', () => {
    const first = createPrivateSendQuoteSessionState({
      intentRevision: 1,
      request,
      surfaceId: 'surface-1',
    });
    const second = createPrivateSendQuoteSessionState({
      intentRevision: 2,
      request,
      surfaceId: 'surface-1',
    });
    const changedRequest = createPrivateSendQuoteSessionState({
      intentRevision: 3,
      request: { ...request, fromTokenAmount: '2' },
      surfaceId: 'surface-1',
    });

    expect(second.session.requestId).not.toBe(first.session.requestId);
    expect(second.session.intentRevision).toBeGreaterThan(
      first.session.intentRevision,
    );
    expect(second.session.fingerprint).toBe(first.session.fingerprint);
    expect(changedRequest.session.fingerprint).not.toBe(
      second.session.fingerprint,
    );
  });

  it('does not reuse a native quote fingerprint for an incomplete non-native token', () => {
    const native = createPrivateSendQuoteSessionState({
      intentRevision: 1,
      request,
      surfaceId: 'surface-1',
    });
    const incompleteNonNative = createPrivateSendQuoteSessionState({
      intentRevision: 2,
      request: {
        ...request,
        fromToken: { ...request.fromToken, isNative: false },
      },
      surfaceId: 'surface-1',
    });

    expect(incompleteNonNative.session.fingerprint).not.toBe(
      native.session.fingerprint,
    );
  });

  it('builds exact cancellation params for only the active request', () => {
    const state = buildState({
      requestId: 'request-current',
      surfaceId: 'surface-current',
    });

    expect(buildPrivateSendQuoteCancelParams(state.session)).toEqual({
      surfaceId: 'surface-current',
      requestId: 'request-current',
    });
  });

  it('pins the matching background generation from the start result', () => {
    const state = buildState();
    const transition = acceptPrivateSendQuoteSessionStartResult({
      state,
      result: {
        accepted: true,
        session: state.session,
        bgGeneration: 3,
      },
    });

    expect(transition).toEqual({
      accepted: true,
      state: { ...state, bgGeneration: 3, terminal: false },
    });
  });

  it('rejects a stale request identity', () => {
    const state = buildState({ requestId: 'request-current' });
    const staleState = buildState({ requestId: 'request-stale' });

    expect(
      acceptPrivateSendQuoteSessionEvent({
        state,
        event: buildEvent({ state: staleState }),
        paramsMatched: true,
      }),
    ).toEqual({ accepted: false, state });
  });

  it('rejects an event from another component surface', () => {
    const state = buildState({ surfaceId: 'node-1:private-send:instance-1' });
    const otherSurfaceState = {
      ...state,
      session: {
        ...state.session,
        surfaceId: 'node-1:private-send:instance-2',
      },
    };

    expect(
      acceptPrivateSendQuoteSessionEvent({
        state,
        event: buildEvent({ state: otherSurfaceState }),
        paramsMatched: true,
      }),
    ).toEqual({ accepted: false, state });
  });

  it('rejects an old terminal event after a new intent revision starts', () => {
    const state = buildState({ intentRevision: 2, requestId: 'request-2' });
    const oldState = buildState({ intentRevision: 1, requestId: 'request-1' });

    expect(
      acceptPrivateSendQuoteSessionEvent({
        state,
        event: buildEvent({ state: oldState, kind: 'done' }),
        paramsMatched: true,
      }),
    ).toEqual({ accepted: false, state });
  });

  it('rejects events after the active session reaches a terminal event', () => {
    const state = buildState();
    const terminal = acceptPrivateSendQuoteSessionEvent({
      state,
      event: buildEvent({ state, kind: 'done', sequence: 1 }),
      paramsMatched: true,
    });

    expect(terminal.accepted).toBe(true);
    expect(
      acceptPrivateSendQuoteSessionEvent({
        state: terminal.state,
        event: buildEvent({ state, sequence: 2 }),
        paramsMatched: true,
      }),
    ).toEqual({ accepted: false, state: terminal.state });
  });

  it('rejects duplicate and out-of-order sequences', () => {
    const state = buildState();
    const first = acceptPrivateSendQuoteSessionEvent({
      state,
      event: buildEvent({ state, sequence: 2 }),
      paramsMatched: true,
    });

    expect(first.accepted).toBe(true);
    expect(
      acceptPrivateSendQuoteSessionEvent({
        state: first.state,
        event: buildEvent({ state, sequence: 2 }),
        paramsMatched: true,
      }),
    ).toEqual({ accepted: false, state: first.state });
    expect(
      acceptPrivateSendQuoteSessionEvent({
        state: first.state,
        event: buildEvent({ state, sequence: 1 }),
        paramsMatched: true,
      }),
    ).toEqual({ accepted: false, state: first.state });
  });

  it('rejects a mismatched background generation', () => {
    const state = { ...buildState(), bgGeneration: 2 };

    expect(
      acceptPrivateSendQuoteSessionEvent({
        state,
        event: buildEvent({ state, bgGeneration: 1 }),
        paramsMatched: true,
      }),
    ).toEqual({ accepted: false, state });
  });

  it('keeps the full request params matcher as an independent gate', () => {
    const state = buildState();

    expect(
      acceptPrivateSendQuoteSessionEvent({
        state,
        event: buildEvent({ state }),
        paramsMatched: false,
      }),
    ).toEqual({ accepted: false, state });
  });

  it('safely ignores malformed event data', () => {
    expect(parsePrivateSendQuoteEventDataSafe('{bad json')).toBeUndefined();
    expect(parsePrivateSendQuoteEventDataSafe('null')).toBeUndefined();
    expect(parsePrivateSendQuoteEventDataSafe('')).toBeUndefined();
    expect(parsePrivateSendQuoteEventDataSafe('{"totalQuoteCount":1}')).toEqual(
      { totalQuoteCount: 1 },
    );
  });
});
