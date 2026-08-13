import { renderHook } from '@testing-library/react-native';

import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { useSettledSwapRecipientRequired } from './useSettledSwapRecipientRequired';

const ETH = { networkId: 'evm--1', contractAddress: '' };
const USDC = { networkId: 'evm--1', contractAddress: '0xusdc' };
const SOL = { networkId: 'sol--101', contractAddress: '' };

type IProps = Parameters<typeof useSettledSwapRecipientRequired>[0];

const quotingRound: IProps = {
  swapType: ESwapTabSwitchType.SWAP,
  fromToken: ETH,
  toToken: SOL,
  sourceAccountId: 'account-1',
  quoteSettled: false,
  isAddressInfoReady: true,
  recipientRequiredNow: false,
};

const settledRoundRequiringRecipient: IProps = {
  ...quotingRound,
  quoteSettled: true,
  recipientRequiredNow: true,
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

    // Quote expires and a refresh starts: the raw verdict drops to false while
    // no quote is selected. The entry must not collapse here.
    rerender({ ...quotingRound, quoteSettled: false });
    expect(result.current).toBe(true);

    // New quote for the same pair settles and still needs a recipient.
    rerender(settledRoundRequiringRecipient);
    expect(result.current).toBe(true);
  });

  it('adopts the new verdict when the settled outcome actually changes', () => {
    const { result, rerender } = renderSettled(settledRoundRequiringRecipient);
    expect(result.current).toBe(true);

    rerender({
      ...settledRoundRequiringRecipient,
      recipientRequiredNow: false,
    });
    expect(result.current).toBe(false);
  });

  it('drops a Swap verdict when switching to Limit before any quote settles', () => {
    // Reproduces the reported lifecycle: swapTypeSwitchAction clears the quote
    // list and resets quoteEventCompleted, so the next render has no settled
    // quote at all while both tokens are still selected.
    const { result, rerender } = renderSettled(settledRoundRequiringRecipient);
    expect(result.current).toBe(true);

    rerender({
      ...settledRoundRequiringRecipient,
      swapType: ESwapTabSwitchType.LIMIT,
      quoteSettled: false,
      recipientRequiredNow: false,
    });
    expect(result.current).toBe(false);
  });

  it('drops the verdict when the token pair changes mid-flight', () => {
    const { result, rerender } = renderSettled(settledRoundRequiringRecipient);
    expect(result.current).toBe(true);

    rerender({
      ...settledRoundRequiringRecipient,
      fromToken: USDC,
      quoteSettled: false,
      recipientRequiredNow: false,
    });
    expect(result.current).toBe(false);
  });

  it('drops the verdict when the source account changes mid-flight', () => {
    const { result, rerender } = renderSettled(settledRoundRequiringRecipient);
    expect(result.current).toBe(true);

    rerender({
      ...settledRoundRequiringRecipient,
      sourceAccountId: 'account-2',
      quoteSettled: false,
      recipientRequiredNow: false,
    });
    expect(result.current).toBe(false);
  });

  it('re-establishes the verdict once the new scope settles its own quote', () => {
    const { result, rerender } = renderSettled(settledRoundRequiringRecipient);

    const limitScope: IProps = {
      ...settledRoundRequiringRecipient,
      swapType: ESwapTabSwitchType.LIMIT,
      quoteSettled: false,
      recipientRequiredNow: false,
    };
    rerender(limitScope);
    expect(result.current).toBe(false);

    rerender({ ...limitScope, quoteSettled: true, recipientRequiredNow: true });
    expect(result.current).toBe(true);
  });

  it('shows the entry when the account resolves while a quote already needs one', () => {
    // The source account id starts undefined and resolves on a later render.
    // That render changes the scope key and carries settled inputs at once;
    // since the verdict lives in a ref, dropping it here would leave the entry
    // hidden with no follow-up render to recover it.
    const { result, rerender } = renderSettled({
      ...quotingRound,
      sourceAccountId: undefined,
      quoteSettled: false,
      recipientRequiredNow: false,
    });
    expect(result.current).toBe(false);

    rerender({
      ...quotingRound,
      sourceAccountId: 'account-1',
      quoteSettled: true,
      recipientRequiredNow: true,
    });
    expect(result.current).toBe(true);

    // And it stays put through the following quote refresh window.
    rerender({
      ...quotingRound,
      sourceAccountId: 'account-1',
      quoteSettled: false,
      recipientRequiredNow: false,
    });
    expect(result.current).toBe(true);
  });

  it('waits for target address resolution before adopting a verdict', () => {
    const { result, rerender } = renderSettled({
      ...quotingRound,
      quoteSettled: true,
      isAddressInfoReady: false,
      recipientRequiredNow: true,
    });
    // Address resolution still pending: nothing to adopt yet.
    expect(result.current).toBe(false);

    rerender({
      ...quotingRound,
      quoteSettled: true,
      isAddressInfoReady: true,
      recipientRequiredNow: true,
    });
    expect(result.current).toBe(true);
  });
});
