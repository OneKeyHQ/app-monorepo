import type {
  IFetchSwapQuoteParams,
  ISwapQuoteSessionEventV2,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapQuoteKind,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import {
  SWAP_QUOTE_SESSION_V2_INITIAL_STATE,
  acceptSwapQuoteSessionEvent,
  applySwapQuoteSessionStartResult,
  buildSwapQuoteDisplayIntentFingerprint,
  buildSwapQuoteExecutionFingerprint,
  invalidateSwapQuoteSession,
  parseSwapQuoteEventDataSafe,
  prepareSwapQuoteSession,
} from './quoteSessionV2';

function buildRequest(
  overrides: Partial<IFetchSwapQuoteParams> = {},
): IFetchSwapQuoteParams {
  return {
    fromToken: {
      networkId: 'evm--1',
      contractAddress: '0xfrom',
      symbol: 'FROM',
      decimals: 18,
    },
    toToken: {
      networkId: 'evm--1',
      contractAddress: '0xto',
      symbol: 'TO',
      decimals: 6,
    },
    fromTokenAmount: '1',
    userAddress: '0xuser',
    receivingAddress: '0xreceiver',
    slippagePercentage: 1,
    kind: ESwapQuoteKind.SELL,
    protocol: ESwapTabSwitchType.SWAP,
    ...overrides,
  } as IFetchSwapQuoteParams;
}

function buildEvent(
  state: ReturnType<typeof prepareSwapQuoteSession>,
  overrides: Partial<ISwapQuoteSessionEventV2> = {},
): ISwapQuoteSessionEventV2 {
  return {
    version: 2,
    kind: 'open',
    session: state.activeSession!,
    bgGeneration: 1,
    sequence: 1,
    emittedAt: 1,
    params: {
      fromTokenAddress: '0xfrom',
      toTokenAddress: '0xto',
      fromNetworkId: 'evm--1',
      toNetworkId: 'evm--1',
      protocol: '0x',
      slippagePercentage: 1,
    },
    tokenPairs: {
      fromToken: buildRequest().fromToken,
      toToken: buildRequest().toToken,
    },
    ...overrides,
  } as ISwapQuoteSessionEventV2;
}

describe('quoteSessionV2', () => {
  it('builds the same fingerprint regardless of object insertion order', () => {
    const request = buildRequest();
    const reordered = {
      ...buildRequest(),
      fromToken: { ...request.fromToken },
    };
    expect(buildSwapQuoteExecutionFingerprint(request)).toBe(
      buildSwapQuoteExecutionFingerprint(reordered),
    );
  });

  it.each([
    ['accountId', { accountId: 'account-2' }],
    ['sender', { userAddress: '0xother' }],
    ['receiver', { receivingAddress: '0xother' }],
    ['amount', { fromTokenAmount: '2' }],
    ['slippage', { slippagePercentage: 2 }],
    ['kind', { kind: ESwapQuoteKind.BUY, toTokenAmount: '3' }],
  ])('changes fingerprint when %s changes', (_name, overrides) => {
    expect(buildSwapQuoteExecutionFingerprint(buildRequest())).not.toBe(
      buildSwapQuoteExecutionFingerprint(buildRequest(overrides)),
    );
  });

  it('keeps AUTO display intent stable when only the suggested percentage changes', () => {
    const first = buildRequest({
      autoSlippage: true,
      slippagePercentage: 0.5,
    });
    const refreshed = buildRequest({
      autoSlippage: true,
      slippagePercentage: 1.2,
    });

    expect(buildSwapQuoteExecutionFingerprint(first)).not.toBe(
      buildSwapQuoteExecutionFingerprint(refreshed),
    );
    expect(buildSwapQuoteDisplayIntentFingerprint(first)).toBe(
      buildSwapQuoteDisplayIntentFingerprint(refreshed),
    );
  });

  it('keeps display intent stable across approval block refreshes while execution ownership changes', () => {
    const beforeApproval = buildRequest({ blockNumber: undefined });
    const afterApproval = buildRequest({ blockNumber: 123_456 });

    expect(buildSwapQuoteExecutionFingerprint(beforeApproval)).not.toBe(
      buildSwapQuoteExecutionFingerprint(afterApproval),
    );
    expect(buildSwapQuoteDisplayIntentFingerprint(beforeApproval)).toBe(
      buildSwapQuoteDisplayIntentFingerprint(afterApproval),
    );
  });

  it.each([
    {
      kind: ESwapQuoteKind.SELL,
      first: buildRequest({
        kind: ESwapQuoteKind.SELL,
        fromTokenAmount: '1',
        toTokenAmount: '10',
      }),
      refreshed: buildRequest({
        kind: ESwapQuoteKind.SELL,
        fromTokenAmount: '1',
        toTokenAmount: '11',
      }),
    },
    {
      kind: ESwapQuoteKind.BUY,
      first: buildRequest({
        kind: ESwapQuoteKind.BUY,
        fromTokenAmount: '10',
        toTokenAmount: '1',
      }),
      refreshed: buildRequest({
        kind: ESwapQuoteKind.BUY,
        fromTokenAmount: '11',
        toTokenAmount: '1',
      }),
    },
  ])(
    'keeps $kind display intent stable when only the projected output changes',
    ({ first, refreshed }) => {
      expect(buildSwapQuoteDisplayIntentFingerprint(first)).toBe(
        buildSwapQuoteDisplayIntentFingerprint(refreshed),
      );
      expect(buildSwapQuoteExecutionFingerprint(first)).not.toBe(
        buildSwapQuoteExecutionFingerprint(refreshed),
      );
    },
  );

  it.each([
    {
      kind: ESwapQuoteKind.SELL,
      first: buildRequest({
        kind: ESwapQuoteKind.SELL,
        fromTokenAmount: '1',
        toTokenAmount: '10',
      }),
      changed: buildRequest({
        kind: ESwapQuoteKind.SELL,
        fromTokenAmount: '2',
        toTokenAmount: '10',
      }),
    },
    {
      kind: ESwapQuoteKind.BUY,
      first: buildRequest({
        kind: ESwapQuoteKind.BUY,
        fromTokenAmount: '10',
        toTokenAmount: '1',
      }),
      changed: buildRequest({
        kind: ESwapQuoteKind.BUY,
        fromTokenAmount: '10',
        toTokenAmount: '2',
      }),
    },
  ])(
    'changes $kind display and execution fingerprints when the active input changes',
    ({ first, changed }) => {
      expect(buildSwapQuoteDisplayIntentFingerprint(first)).not.toBe(
        buildSwapQuoteDisplayIntentFingerprint(changed),
      );
      expect(buildSwapQuoteExecutionFingerprint(first)).not.toBe(
        buildSwapQuoteExecutionFingerprint(changed),
      );
    },
  );

  it('changes display intent for CUSTOM slippage and semantic owner changes', () => {
    const custom = buildRequest({
      autoSlippage: false,
      slippagePercentage: 0.5,
    });
    expect(buildSwapQuoteDisplayIntentFingerprint(custom)).not.toBe(
      buildSwapQuoteDisplayIntentFingerprint(
        buildRequest({
          autoSlippage: false,
          slippagePercentage: 1.2,
        }),
      ),
    );
    expect(buildSwapQuoteDisplayIntentFingerprint(custom)).not.toBe(
      buildSwapQuoteDisplayIntentFingerprint(
        buildRequest({
          autoSlippage: false,
          slippagePercentage: 0.5,
          accountId: 'account-2',
        }),
      ),
    );
    expect(buildSwapQuoteDisplayIntentFingerprint(custom)).not.toBe(
      buildSwapQuoteDisplayIntentFingerprint(
        buildRequest({
          autoSlippage: false,
          slippagePercentage: 0.5,
          fromTokenAmount: '2',
        }),
      ),
    );
  });

  it('rejects stale, duplicate, and out-of-order events', () => {
    const stateA = prepareSwapQuoteSession({
      request: buildRequest(),
      state: SWAP_QUOTE_SESSION_V2_INITIAL_STATE,
    });
    const accepted = acceptSwapQuoteSessionEvent({
      state: stateA,
      event: buildEvent(stateA),
    });
    expect(accepted.accepted).toBe(true);

    expect(
      acceptSwapQuoteSessionEvent({
        state: accepted.state,
        event: buildEvent(stateA),
      }).accepted,
    ).toBe(false);

    const stateB = prepareSwapQuoteSession({
      request: buildRequest({ fromTokenAmount: '2' }),
      state: stateA,
    });
    expect(
      acceptSwapQuoteSessionEvent({
        state: stateB,
        event: buildEvent(stateA, { sequence: 2 }),
      }).accepted,
    ).toBe(false);
  });

  it('rejects an old generation even when identity matches', () => {
    const prepared = prepareSwapQuoteSession({
      request: buildRequest(),
      state: SWAP_QUOTE_SESSION_V2_INITIAL_STATE,
    });
    const accepted = acceptSwapQuoteSessionEvent({
      state: prepared,
      event: buildEvent(prepared, { bgGeneration: 2 }),
    });
    expect(accepted.accepted).toBe(true);
    expect(
      acceptSwapQuoteSessionEvent({
        state: accepted.state,
        event: buildEvent(prepared, { bgGeneration: 1, sequence: 2 }),
      }).accepted,
    ).toBe(false);
  });

  it('invalidates the active request and increments the intent revision', () => {
    const prepared = prepareSwapQuoteSession({
      request: buildRequest(),
      state: SWAP_QUOTE_SESSION_V2_INITIAL_STATE,
    });
    const invalidated = invalidateSwapQuoteSession(prepared);
    expect(invalidated.activeSession).toBeUndefined();
    expect(invalidated.intentRevision).toBe(prepared.intentRevision + 1);
  });

  it('does not revive a session that settled before start returned', () => {
    const prepared = prepareSwapQuoteSession({
      request: buildRequest(),
      state: SWAP_QUOTE_SESSION_V2_INITIAL_STATE,
    });
    const settled = acceptSwapQuoteSessionEvent({
      state: prepared,
      event: buildEvent(prepared, { kind: 'done' }),
    });
    const transition = applySwapQuoteSessionStartResult({
      state: settled.state,
      result: {
        accepted: true,
        session: prepared.activeSession!,
        bgGeneration: 1,
      },
    });

    expect(transition.accepted).toBe(true);
    expect(transition.state.phase).toBe('settled');
  });

  it.each(['settled', 'cancelled', 'error'] as const)(
    'rejects higher-sequence events after the %s terminal phase',
    (phase) => {
      const prepared = prepareSwapQuoteSession({
        request: buildRequest(),
        state: SWAP_QUOTE_SESSION_V2_INITIAL_STATE,
      });
      const terminalState = {
        ...prepared,
        bgGeneration: 1,
        lastSequence: 1,
        phase,
      };

      expect(
        acceptSwapQuoteSessionEvent({
          state: terminalState,
          event: buildEvent(prepared, { sequence: 2 }),
        }),
      ).toEqual({ accepted: false, state: terminalState });
    },
  );

  it('ignores malformed event data', () => {
    expect(parseSwapQuoteEventDataSafe('{bad json')).toBeUndefined();
    expect(parseSwapQuoteEventDataSafe('null')).toBeUndefined();
    expect(parseSwapQuoteEventDataSafe('{"totalQuoteCount":1}')).toEqual({
      totalQuoteCount: 1,
    });
  });
});
