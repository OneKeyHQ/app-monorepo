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
  invalidateSwapQuoteSession,
  prepareSwapQuoteSession,
} from '../../../states/jotai/contexts/swap/quoteSessionV2';

import { getSwapQuoteFocusLifecycleTransition } from './swapQuoteFocusLifecycle';

function buildRequest(): IFetchSwapQuoteParams {
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
  } as IFetchSwapQuoteParams;
}

function buildEvent({
  kind,
  sequence,
  session,
}: {
  kind: ISwapQuoteSessionEventV2['kind'];
  sequence: number;
  session: NonNullable<
    ReturnType<typeof prepareSwapQuoteSession>['activeSession']
  >;
}): ISwapQuoteSessionEventV2 {
  return {
    version: 2,
    kind,
    session,
    bgGeneration: 1,
    sequence,
    emittedAt: sequence,
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
  } as ISwapQuoteSessionEventV2;
}

describe('swapQuoteFocusLifecycle', () => {
  it('refreshes preserved cold-start input after readiness and a real tab round trip', () => {
    const coldMount = getSwapQuoteFocusLifecycleTransition({
      hasPendingPreservedInputRefresh: false,
      isHiddenByOverlay: false,
      isQuotePaused: true,
      isTabFocused: true,
      shouldPreserveUserInputOnExit: true,
    });
    expect(coldMount.shouldAttachSessionListeners).toBe(true);
    expect(coldMount.shouldRefreshPreservedInput).toBe(false);

    const readinessReadyThenExit = getSwapQuoteFocusLifecycleTransition({
      hasPendingPreservedInputRefresh:
        coldMount.nextShouldRefreshPreservedInput,
      isHiddenByOverlay: false,
      isQuotePaused: false,
      isTabFocused: false,
      shouldPreserveUserInputOnExit: true,
    });
    expect(readinessReadyThenExit).toMatchObject({
      visibility: 'exited',
      shouldDetachSessionListeners: true,
      shouldInvalidateIntent: true,
      shouldClearUserInput: false,
      nextShouldRefreshPreservedInput: true,
    });

    const reenter = getSwapQuoteFocusLifecycleTransition({
      hasPendingPreservedInputRefresh:
        readinessReadyThenExit.nextShouldRefreshPreservedInput,
      isHiddenByOverlay: false,
      isQuotePaused: false,
      isTabFocused: true,
      shouldPreserveUserInputOnExit: true,
    });
    expect(reenter).toMatchObject({
      visibility: 'focused',
      shouldAttachSessionListeners: true,
      shouldRefreshPreservedInput: true,
      nextShouldRefreshPreservedInput: false,
    });
  });

  it('keeps an in-flight session eligible for done while a root overlay hides route focus', () => {
    const prepared = prepareSwapQuoteSession({
      request: buildRequest(),
      state: SWAP_QUOTE_SESSION_V2_INITIAL_STATE,
    });
    const streaming = acceptSwapQuoteSessionEvent({
      state: prepared,
      event: buildEvent({
        kind: 'open',
        sequence: 1,
        session: prepared.activeSession!,
      }),
    });
    expect(streaming.accepted).toBe(true);

    const temporarilyHidden = getSwapQuoteFocusLifecycleTransition({
      hasPendingPreservedInputRefresh: false,
      isHiddenByOverlay: true,
      isQuotePaused: false,
      isTabFocused: true,
      shouldPreserveUserInputOnExit: true,
    });
    expect(temporarilyHidden).toMatchObject({
      visibility: 'temporarily-hidden',
      shouldAttachSessionListeners: true,
      shouldDetachSessionListeners: false,
      shouldInvalidateIntent: false,
    });

    const done = acceptSwapQuoteSessionEvent({
      state: streaming.state,
      event: buildEvent({
        kind: 'done',
        sequence: 2,
        session: prepared.activeSession!,
      }),
    });
    expect(done.accepted).toBe(true);
    expect(done.state.phase).toBe('settled');
  });

  it('invalidates and detaches on a real tab exit so late done stays stale', () => {
    const prepared = prepareSwapQuoteSession({
      request: buildRequest(),
      state: SWAP_QUOTE_SESSION_V2_INITIAL_STATE,
    });
    const exited = getSwapQuoteFocusLifecycleTransition({
      hasPendingPreservedInputRefresh: false,
      isHiddenByOverlay: false,
      isQuotePaused: false,
      isTabFocused: false,
      shouldPreserveUserInputOnExit: false,
    });
    expect(exited).toMatchObject({
      visibility: 'exited',
      shouldDetachSessionListeners: true,
      shouldInvalidateIntent: true,
      shouldClearUserInput: true,
    });

    const invalidated = invalidateSwapQuoteSession(prepared);
    const lateDone = acceptSwapQuoteSessionEvent({
      state: invalidated,
      event: buildEvent({
        kind: 'done',
        sequence: 1,
        session: prepared.activeSession!,
      }),
    });
    expect(lateDone.accepted).toBe(false);
    expect(lateDone.state.phase).toBe('cancelled');
  });
});
