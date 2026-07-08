import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';

import {
  findSupportedBorrowMarket,
  resolveLendingStepState,
  resolvePostActionNavigation,
  resolveProtocolLendingDefiFillableAmountState,
  resolveProtocolLendingRemainingDebtState,
  resolveProtocolLendingRepayAmountState,
  resolveVisibleLendingStepState,
  shouldAutoSubmitLendingStep2,
} from './protocolLendingActionUtils';

describe('protocolLendingActionUtils', () => {
  it('uses server maxRepayBalance for repay max before wallet balance resolves', () => {
    const state = resolveProtocolLendingRepayAmountState({
      amount: '2',
      referenceBalance: '10',
      maxRepayBalance: '2',
      repayAllTargetAmount: '10',
    });

    expect(state.valueForMax).toBe('2');
    expect(state.isFullClose).toBe(false);
    expect(state.isAmountInsufficient).toBe(false);
  });

  it('does not mark wallet-capped max as full repay', () => {
    const state = resolveProtocolLendingRepayAmountState({
      amount: '2',
      referenceBalance: '10',
      maxRepayBalance: '2',
      repayWalletBalance: '2',
      repayAllTargetAmount: '10',
    });

    expect(state.isFullClose).toBe(false);
  });

  it('marks amount above repay max as insufficient', () => {
    const state = resolveProtocolLendingRepayAmountState({
      amount: '3',
      referenceBalance: '10',
      maxRepayBalance: '2',
      repayAllTargetAmount: '10',
    });

    expect(state.isAmountInsufficient).toBe(true);
  });

  it('uses the raw debt amount as the full-repay target', () => {
    const state = resolveProtocolLendingRepayAmountState({
      amount: '10.123456',
      referenceBalance: '10.12',
      maxRepayBalance: '10.123456',
      repayAllTargetAmount: '10.123456',
    });

    expect(state.valueForMax).toBe('10.123456');
    expect(state.isFullClose).toBe(true);
  });

  it('does not treat a wallet-capped max as full-close when repayAllTargetAmount is missing', () => {
    // Without a real debt target we cannot prove a full repay — referenceBalance
    // may itself be a wallet-capped max — so isFullClose must stay false so a
    // partial repay is never sent to the borrow build path as repayAll.
    const state = resolveProtocolLendingRepayAmountState({
      amount: '10',
      referenceBalance: '10',
    });
    expect(state.isFullClose).toBe(false);
  });

  it('does not report repayAll when only a wallet-capped maxRepayBalance is known (no real debt)', () => {
    // Fixed-mode repay with no debtBalance: referenceBalance falls back to the
    // wallet-capped maxRepayBalance and repayAllTargetAmount is absent. A Max
    // fill equals maxRepayBalance but is a partial repay, not a full close.
    const state = resolveProtocolLendingRepayAmountState({
      amount: '2',
      referenceBalance: '2',
      maxRepayBalance: '2',
      repayWalletBalance: '2',
    });

    expect(state.valueForMax).toBe('2');
    expect(state.isFullClose).toBe(false);
  });

  it('keeps defi repay max unavailable before wallet balance resolves', () => {
    const state = resolveProtocolLendingDefiFillableAmountState({
      isRepay: true,
      availableAmount: '10',
    });

    expect(state.isRepayWalletBalanceReady).toBe(false);
    expect(state.fillableMax).toBe('0');
    expect(state.isFillableMaxFullClose).toBe(false);
  });

  it('caps defi repay max to wallet balance and treats wallet-capped max as partial', () => {
    const state = resolveProtocolLendingDefiFillableAmountState({
      isRepay: true,
      availableAmount: '10',
      repayWalletBalance: '2',
    });

    expect(state.isRepayWalletBalanceReady).toBe(true);
    expect(state.fillableMax).toBe('2');
    expect(state.isFillableMaxFullClose).toBe(false);
  });

  it('treats defi repay max as full close only when wallet covers the debt', () => {
    const state = resolveProtocolLendingDefiFillableAmountState({
      isRepay: true,
      availableAmount: '10',
      repayWalletBalance: '12',
    });

    expect(state.isRepayWalletBalanceReady).toBe(true);
    expect(state.fillableMax).toBe('10');
    expect(state.isFillableMaxFullClose).toBe(true);
  });

  it('shows the remaining debt after a wallet-capped repay', () => {
    const state = resolveProtocolLendingRemainingDebtState({
      amount: '2',
      debtAmount: '10',
    });

    expect(state).toEqual({
      currentDebt: '10',
      remainingDebt: '8',
    });
  });

  it('floors remaining debt at zero for over-target amounts', () => {
    const state = resolveProtocolLendingRemainingDebtState({
      amount: '12',
      debtAmount: '10',
    });

    expect(state).toEqual({
      currentDebt: '10',
      remainingDebt: '0',
    });
  });
});

describe('findSupportedBorrowMarket', () => {
  const markets = [
    {
      provider: 'kamino',
      networkId: 'sol--101',
      marketAddress: '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF',
    },
    {
      provider: 'aave',
      networkId: 'evm--1',
      marketAddress: '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2',
    },
  ];

  it('matches a checksum-cased EVM address against the lowercase list', () => {
    expect(
      findSupportedBorrowMarket({
        markets,
        provider: 'aave',
        networkId: 'evm--1',
        marketAddress: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      }),
    ).toBe(markets[1]);
  });

  it('tolerates provider case/whitespace differences', () => {
    expect(
      findSupportedBorrowMarket({
        markets,
        provider: ' Aave ',
        networkId: 'evm--1',
        marketAddress: '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2',
      }),
    ).toBe(markets[1]);
  });

  it('misses on provider not in the list', () => {
    expect(
      findSupportedBorrowMarket({
        markets,
        provider: 'aave',
        networkId: 'sol--101',
        marketAddress: '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF',
      }),
    ).toBeUndefined();
  });

  it('misses on networkId mismatch', () => {
    expect(
      findSupportedBorrowMarket({
        markets,
        provider: 'aave',
        networkId: 'evm--8453',
        marketAddress: '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2',
      }),
    ).toBeUndefined();
  });

  it('matches Solana addresses case-sensitively', () => {
    expect(
      findSupportedBorrowMarket({
        markets,
        provider: 'kamino',
        networkId: 'sol--101',
        marketAddress: '7u3heHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF',
      }),
    ).toBeUndefined();
  });

  it('fails closed when markets are undefined or empty', () => {
    expect(
      findSupportedBorrowMarket({
        markets: undefined,
        provider: 'aave',
        networkId: 'evm--1',
        marketAddress: '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2',
      }),
    ).toBeUndefined();
    expect(
      findSupportedBorrowMarket({
        markets: [],
        provider: 'aave',
        networkId: 'evm--1',
        marketAddress: '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2',
      }),
    ).toBeUndefined();
  });

  it('fails closed when provider or marketAddress is missing', () => {
    expect(
      findSupportedBorrowMarket({
        markets,
        provider: undefined,
        networkId: 'evm--1',
        marketAddress: '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2',
      }),
    ).toBeUndefined();
    expect(
      findSupportedBorrowMarket({
        markets,
        provider: 'aave',
        networkId: 'evm--1',
        marketAddress: undefined,
      }),
    ).toBeUndefined();
  });
});

describe('resolveLendingStepState', () => {
  it('waiting allowance wins over every other state', () => {
    expect(
      resolveLendingStepState({
        needsApproval: true,
        waitingAllowance: true,
        approveSessionActive: true,
      }),
    ).toEqual({ kind: 'waitingAllowance' });
  });

  it('needs approval shows step 1 even after an approve this session', () => {
    expect(
      resolveLendingStepState({
        needsApproval: true,
        waitingAllowance: false,
        approveSessionActive: true,
      }),
    ).toEqual({ kind: 'approveStep1' });
  });

  it('after an approve session with allowance covered shows step 2', () => {
    expect(
      resolveLendingStepState({
        needsApproval: false,
        waitingAllowance: false,
        approveSessionActive: true,
      }),
    ).toEqual({ kind: 'actionStep2' });
  });

  it('plain action when no approve was ever involved', () => {
    expect(
      resolveLendingStepState({
        needsApproval: false,
        waitingAllowance: false,
        approveSessionActive: false,
      }),
    ).toEqual({ kind: 'action' });
  });
});

describe('resolveVisibleLendingStepState', () => {
  it('keeps the submitted step visible while navigation blurs the route', () => {
    expect(
      resolveVisibleLendingStepState({
        liveStepState: { kind: 'approveStep1' },
        submitting: true,
        submittedStepKind: 'actionStep2',
      }),
    ).toEqual({ kind: 'actionStep2' });
  });

  it('falls back to the live step outside an active submit', () => {
    expect(
      resolveVisibleLendingStepState({
        liveStepState: { kind: 'approveStep1' },
        submitting: false,
        submittedStepKind: 'actionStep2',
      }),
    ).toEqual({ kind: 'approveStep1' });
  });
});

describe('shouldAutoSubmitLendingStep2', () => {
  it('auto-fires step 2 once the approve settled and the allowance covers it', () => {
    expect(
      shouldAutoSubmitLendingStep2({
        stepKind: 'actionStep2',
        submitting: false,
        alreadyAutoSubmitted: false,
      }),
    ).toBe(true);
  });

  it('does not auto-fire before the approve completes', () => {
    expect(
      shouldAutoSubmitLendingStep2({
        stepKind: 'approveStep1',
        submitting: false,
        alreadyAutoSubmitted: false,
      }),
    ).toBe(false);
    expect(
      shouldAutoSubmitLendingStep2({
        stepKind: 'waitingAllowance',
        submitting: false,
        alreadyAutoSubmitted: false,
      }),
    ).toBe(false);
  });

  it('never auto-fires the plain single-step action (no approve involved)', () => {
    expect(
      shouldAutoSubmitLendingStep2({
        stepKind: 'action',
        submitting: false,
        alreadyAutoSubmitted: false,
      }),
    ).toBe(false);
  });

  it('does not re-fire while a submit is already in flight', () => {
    expect(
      shouldAutoSubmitLendingStep2({
        stepKind: 'actionStep2',
        submitting: true,
        alreadyAutoSubmitted: false,
      }),
    ).toBe(false);
  });

  it('fires only once per approve session (dedupe)', () => {
    expect(
      shouldAutoSubmitLendingStep2({
        stepKind: 'actionStep2',
        submitting: false,
        alreadyAutoSubmitted: true,
      }),
    ).toBe(false);
  });
});

describe('resolvePostActionNavigation', () => {
  it('closes to page on Success regardless of amount shape', () => {
    expect(
      resolvePostActionNavigation({
        txStatus: EOnChainHistoryTxStatus.Success,
      }),
    ).toBe('closeToPage');
    expect(
      resolvePostActionNavigation({
        txStatus: EOnChainHistoryTxStatus.Success,
      }),
    ).toBe('closeToPage');
  });

  it('closes to page on Failed because it is a final chain status', () => {
    expect(
      resolvePostActionNavigation({
        txStatus: EOnChainHistoryTxStatus.Failed,
      }),
    ).toBe('closeToPage');
  });

  it('keeps the dialog only for an unconfirmed tx or exhausted poll', () => {
    expect(
      resolvePostActionNavigation({
        txStatus: undefined,
      }),
    ).toBe('stayAndRefresh');
  });
});
