/** @jest-environment jsdom */

// Core quoteProgress, cache, and useSwapReviewPreload implementations stay real.
import { renderHook } from '@testing-library/react';

import {
  EProtocolOfExchange,
  ESwapQuoteKind,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { getSwapReviewPreparationKey } from '../utils/swapReviewPreload';

import { useSwapReviewPreload } from './useSwapReviewPreload';

import type { ISwapPreparedBuild, ISwapPreparedReview } from './useSwapBuiltTx';
import type { ISwapQuoteSelectionIntent } from '../../../states/jotai/contexts/swap/quoteProgress';

const fromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  isNative: true,
  symbol: 'ETH',
  decimals: 18,
};
const toToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0x0000000000000000000000000000000000000001',
  isNative: false,
  symbol: 'USDC',
  decimals: 6,
};
const accountAddress = '0x0000000000000000000000000000000000000002';
const accountId = 'hd-lifecycle--0';

function createFixture() {
  return {
    request: {
      type: ESwapTabSwitchType.SWAP,
      actionLock: true,
      fromToken,
      toToken,
      fromTokenAmount: '0.1',
      toTokenAmount: '120',
      kind: ESwapQuoteKind.SELL,
      accountId,
      address: accountAddress,
      receivingAddress: accountAddress,
      quoteRequestId: 'request-1',
    },
    event: {
      eventId: 'event-1',
      count: 4,
      totalQuoteCountReceived: true,
    },
    completed: false,
    manualSelection: undefined as ISwapQuoteSelectionIntent | undefined,
    loading: false,
    shouldRefresh: false,
    fromToken,
    toToken,
    fromAmount: { value: '0.1', isInput: true },
    toAmount: { value: '120', isInput: false },
    swapType: ESwapTabSwitchType.SWAP,
    from: {
      address: accountAddress,
      networkId: fromToken.networkId,
      accountInfo: { account: { id: accountId } },
    },
    to: {
      address: accountAddress,
      networkId: toToken.networkId,
      accountInfo: { account: { id: accountId } },
    },
  };
}

let mockState = createFixture();

jest.mock('../../../states/jotai/contexts/swap', () => ({
  useSwapQuoteActionLockAtom: () => [mockState.request],
  useSwapQuoteEventCompletedAtom: () => [mockState.completed],
  useSwapQuoteEventTotalCountAtom: () => [mockState.event],
  useSwapManualSelectQuoteProvidersAtom: () => [mockState.manualSelection],
  useSwapQuoteFetchingAtom: () => [mockState.loading],
  useSwapShouldRefreshQuoteAtom: () => [mockState.shouldRefresh],
  useSwapSelectFromTokenAtom: () => [mockState.fromToken],
  useSwapSelectToTokenAtom: () => [mockState.toToken],
  useSwapFromTokenAmountAtom: () => [mockState.fromAmount],
  useSwapToTokenAmountAtom: () => [mockState.toAmount],
  useSwapTypeSwitchAtom: () => [mockState.swapType],
}));

jest.mock('./useSwapAccount', () => ({
  useSwapAddressInfo: (direction: string) =>
    direction === 'from' ? mockState.from : mockState.to,
}));

function makeQuote(): IFetchQuoteResult {
  return {
    eventId: 'event-1',
    quoteId: 'quote-a',
    protocol: EProtocolOfExchange.SWAP,
    kind: ESwapQuoteKind.SELL,
    info: { provider: 'provider-a', providerName: 'Provider A' },
    fromTokenInfo: fromToken,
    toTokenInfo: toToken,
    fromAmount: '0.1',
    toAmount: '120',
    quoteResultCtx: { route: 'route-a' },
    // AUTO mode has no server suggestion yet. The production Review action
    // is still loading in this state: useSwapState.ts isWaitingAutoSlippage.
  };
}

function mountPreload(quote: IFetchQuoteResult, waiting = false) {
  const prepare = jest.fn<
    Promise<ISwapPreparedReview>,
    [IFetchQuoteResult, () => boolean]
  >(() => new Promise<ISwapPreparedReview>(() => undefined));
  const prepareBuild = jest.fn<
    Promise<ISwapPreparedBuild>,
    [IFetchQuoteResult, () => boolean]
  >(() => new Promise<ISwapPreparedBuild>(() => undefined));
  const hook = renderHook(
    (props: {
      quote: IFetchQuoteResult;
      enabled: boolean;
      waiting: boolean;
      fee: string;
    }) =>
      useSwapReviewPreload({
        quote: props.quote,
        enabled: props.enabled,
        isWaitingAutoSlippage: props.waiting,
        contextKey: props.fee,
        getBuildKey: (candidate) =>
          getSwapReviewPreparationKey(candidate, accountId),
        prepare,
        prepareBuild,
      }),
    { initialProps: { quote, enabled: true, waiting, fee: 'normal' } },
  );
  return { prepare, prepareBuild, ...hook };
}

beforeEach(() => {
  mockState = createFixture();
});

describe('real preparation hook lifecycle', () => {
  it('waits for required AUTO slippage while CUSTOM and unsupported slippage can proceed', () => {
    const quote = makeQuote();
    mockState.manualSelection = { type: 'manual-provider', info: quote.info };
    const { prepare, prepareBuild, rerender, unmount } = mountPreload(
      quote,
      true,
    );
    // The canonical action state supplies readiness, not the presence of a field.
    rerender({
      quote: { ...quote, autoSuggestedSlippage: 0.5 },
      enabled: true,
      waiting: true,
      fee: 'normal',
    });
    expect(prepareBuild).not.toHaveBeenCalled();
    rerender({
      quote: { ...quote, autoSuggestedSlippage: 0.5 },
      enabled: true,
      waiting: false,
      fee: 'normal',
    });
    expect(prepareBuild).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('ignores recommendation badges and changes only the fee task for a fee preference', () => {
    mockState.completed = true;
    mockState.request.actionLock = false;
    const quote = makeQuote();
    const { prepare, prepareBuild, rerender, unmount } = mountPreload(quote);
    const firstBuildOwner = prepareBuild.mock.calls[0][1];
    const firstFeeOwner = prepare.mock.calls[0][1];
    const decorated = {
      ...quote,
      isBest: true,
      receivedBest: true,
      minGasCost: true,
    };
    rerender({
      quote: decorated,
      enabled: true,
      waiting: false,
      fee: 'normal',
    });
    expect(prepareBuild).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledTimes(1);
    rerender({ quote: decorated, enabled: true, waiting: false, fee: 'fast' });
    expect(prepareBuild).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(firstBuildOwner()).toBe(true);
    expect(firstFeeOwner()).toBe(false);
    unmount();
    expect(firstBuildOwner()).toBe(false);
  });

  it('joins a claimed task when Preview changes enabling atoms and cancels on unmount', () => {
    mockState.completed = true;
    mockState.request.actionLock = false;
    const quote = makeQuote();
    const { prepare, prepareBuild, result, rerender, unmount } =
      mountPreload(quote);
    const claimed = result.current.claimPreparation();
    expect(claimed?.promise).toBe(prepare.mock.results[0].value);
    expect(claimed?.build.promise).toBe(prepareBuild.mock.results[0].value);
    mockState.shouldRefresh = true;
    rerender({ quote, enabled: false, waiting: false, fee: 'normal' });
    expect(claimed?.isCurrent()).toBe(true);
    expect(prepare).toHaveBeenCalledTimes(1);
    unmount();
    expect(claimed?.isCurrent()).toBe(false);
  });

  it('cancels an unclaimed task on leaving and does not use stale authority', () => {
    mockState.completed = true;
    mockState.request.actionLock = false;
    const quote = makeQuote();
    const { prepareBuild, rerender, unmount } = mountPreload(quote);
    const owner = prepareBuild.mock.calls[0][1];
    rerender({ quote, enabled: false, waiting: false, fee: 'normal' });
    expect(owner()).toBe(false);
    mockState.event.eventId = '';
    mockState.request.actionLock = true;
    rerender({ quote, enabled: true, waiting: false, fee: 'normal' });
    expect(prepareBuild).toHaveBeenCalledTimes(1);
    unmount();
  });

  it.each(['btc--0', 'xrp--0', 'tron--0', 'sui--mainnet', 'sol--101'])(
    'does not preload or claim %s even when invoked directly',
    (networkId) => {
      mockState.completed = true;
      mockState.request.actionLock = false;
      const token = { ...fromToken, networkId };
      mockState.fromToken = token;
      mockState.request.fromToken = token;
      mockState.from.networkId = networkId;
      const { prepareBuild, result, unmount } = mountPreload({
        ...makeQuote(),
        fromTokenInfo: token,
      });
      expect(prepareBuild).not.toHaveBeenCalled();
      expect(result.current.claimPreparation()).toBeUndefined();
      expect(prepareBuild).not.toHaveBeenCalled();
      unmount();
    },
  );
});
