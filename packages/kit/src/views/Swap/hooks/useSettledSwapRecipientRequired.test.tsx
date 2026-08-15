import { renderHook } from '@testing-library/react-native';

import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { useSettledSwapRecipientRequired } from './useSettledSwapRecipientRequired';

const ETH = { networkId: 'evm--1', contractAddress: '' };
const USDC = { networkId: 'evm--1', contractAddress: '0xusdc' };
const SOL = { networkId: 'sol--101', contractAddress: '' };

type IProps = Parameters<typeof useSettledSwapRecipientRequired>[0];

function buildQuote({
  fromTokenInfo = ETH,
  toTokenInfo = SOL,
  toAmount = '1',
}: Partial<NonNullable<IProps['quoteResult']>> = {}) {
  return { fromTokenInfo, toTokenInfo, toAmount };
}

// A quote round that settled for ETH -> SOL and needs a manual recipient
// (single-network private-key wallet: no target-chain address).
const settledRoundRequiringRecipient: IProps = {
  swapType: ESwapTabSwitchType.SWAP,
  fromToken: ETH,
  toToken: SOL,
  sourceAccountId: 'account-1',
  quoteResult: buildQuote(),
  quoteSettledWithoutResult: false,
  isAddressInfoReady: true,
  hasTargetAddress: false,
  noConnectWallet: false,
};

// The refresh window of the same round: no quote is selected while requesting.
const quotingRound: IProps = {
  ...settledRoundRequiringRecipient,
  quoteResult: undefined,
};

function renderSettled(initialProps: IProps) {
  return renderHook((props: IProps) => useSettledSwapRecipientRequired(props), {
    initialProps,
  });
}

describe('useSettledSwapRecipientRequired', () => {
  it('holds the verdict through a full quote refresh cycle', () => {
    const { result, rerender } = renderSettled(settledRoundRequiringRecipient);
    expect(result.current).toBe(true);

    // Quote expires and a refresh starts: no quote is selected while the new
    // round is requesting. The entry must not collapse here.
    rerender(quotingRound);
    expect(result.current).toBe(true);

    // The new quote for the same pair settles and still needs a recipient.
    rerender(settledRoundRequiringRecipient);
    expect(result.current).toBe(true);
  });

  it('adopts the new verdict when the settled outcome actually changes', () => {
    const { result, rerender } = renderSettled(settledRoundRequiringRecipient);
    expect(result.current).toBe(true);

    rerender({ ...settledRoundRequiringRecipient, hasTargetAddress: true });
    expect(result.current).toBe(false);
  });

  it('ignores a retained previous-pair quote right after a pair switch', () => {
    // The selection layer intentionally keeps the previous actionable quote
    // visible while the next round is requesting. On the render where the
    // pair has changed but the old ETH->SOL quote is still selected, that
    // quote must not decide the ETH->USDC scope.
    const { result, rerender } = renderSettled(settledRoundRequiringRecipient);
    expect(result.current).toBe(true);

    rerender({
      ...settledRoundRequiringRecipient,
      toToken: USDC,
      // Old pair's quote still selected during the transition render.
      quoteResult: buildQuote({ toTokenInfo: SOL }),
      // Same-network target: an address exists, no recipient needed.
      hasTargetAddress: true,
    });
    expect(result.current).toBe(false);

    // And the stale quote alone cannot resurrect the verdict later either.
    rerender({
      ...settledRoundRequiringRecipient,
      toToken: USDC,
      quoteResult: buildQuote({ toTokenInfo: SOL }),
      hasTargetAddress: false,
    });
    expect(result.current).toBe(false);
  });

  it('drops a Swap verdict when switching to Limit before any quote settles', () => {
    // swapTypeSwitchAction clears the quote list and quoteEventCompleted, so
    // the next render has no settled quote while both tokens stay selected.
    const { result, rerender } = renderSettled(settledRoundRequiringRecipient);
    expect(result.current).toBe(true);

    rerender({
      ...quotingRound,
      swapType: ESwapTabSwitchType.LIMIT,
    });
    expect(result.current).toBe(false);
  });

  it('drops the verdict when the source account changes mid-flight', () => {
    const { result, rerender } = renderSettled(settledRoundRequiringRecipient);
    expect(result.current).toBe(true);

    rerender({
      ...quotingRound,
      sourceAccountId: 'account-2',
    });
    expect(result.current).toBe(false);
  });

  it('re-establishes the verdict once the new scope settles its own quote', () => {
    const { result, rerender } = renderSettled(settledRoundRequiringRecipient);

    const limitScopeQuoting: IProps = {
      ...quotingRound,
      swapType: ESwapTabSwitchType.LIMIT,
    };
    rerender(limitScopeQuoting);
    expect(result.current).toBe(false);

    rerender({
      ...limitScopeQuoting,
      quoteResult: buildQuote(),
    });
    expect(result.current).toBe(true);
  });

  it('shows the entry when the account resolves while a quote already needs one', () => {
    // The source account id starts undefined and resolves on a later render.
    // That render changes the scope key and carries settled inputs at once;
    // since the verdict lives in a ref, dropping it would leave the entry
    // hidden with no follow-up render to recover it.
    const { result, rerender } = renderSettled({
      ...quotingRound,
      sourceAccountId: undefined,
    });
    expect(result.current).toBe(false);

    rerender(settledRoundRequiringRecipient);
    expect(result.current).toBe(true);

    // And it stays put through the following quote refresh window.
    rerender(quotingRound);
    expect(result.current).toBe(true);
  });

  it('waits for target address resolution before adopting a verdict', () => {
    const { result, rerender } = renderSettled({
      ...settledRoundRequiringRecipient,
      isAddressInfoReady: false,
    });
    // Address resolution still pending: nothing to adopt yet.
    expect(result.current).toBe(false);

    rerender(settledRoundRequiringRecipient);
    expect(result.current).toBe(true);
  });

  it('treats a no-result settlement as a definitive not-required verdict', () => {
    const { result, rerender } = renderSettled(settledRoundRequiringRecipient);
    expect(result.current).toBe(true);

    rerender({
      ...quotingRound,
      quoteSettledWithoutResult: true,
    });
    expect(result.current).toBe(false);
  });
});
