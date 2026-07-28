import {
  findSupportedBorrowMarket,
  resolveProtocolLendingBalanceContext,
  resolveProtocolLendingDefiFillableAmountState,
  resolveProtocolLendingRemainingDebtState,
  resolveProtocolLendingRepayAmountState,
  resolveProtocolLendingRepayDebtState,
  resolveProtocolLendingWithdrawAmountState,
} from './protocolLendingActionUtils';

describe('protocolLendingActionUtils', () => {
  it('marks withdraw amount above the supplied balance as insufficient', () => {
    const state = resolveProtocolLendingWithdrawAmountState({
      amount: '10.0001',
      referenceBalance: '10',
    });

    expect(state.isAmountInsufficient).toBe(true);
  });

  it('does not mark exact withdraw max as insufficient', () => {
    const state = resolveProtocolLendingWithdrawAmountState({
      amount: '10',
      referenceBalance: '10',
    });

    expect(state.isAmountInsufficient).toBe(false);
  });

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

  it('uses the row-scoped portfolio debt before a wallet-capped repay max', () => {
    expect(
      resolveProtocolLendingRepayDebtState({
        sourceDebtAmount: '5',
        maxRepayBalance: '2',
      }),
    ).toEqual({
      referenceBalance: '5',
      repayAllTargetAmount: '5',
    });
  });

  it('prefers the refreshed protocol debt over the portfolio snapshot', () => {
    expect(
      resolveProtocolLendingRepayDebtState({
        sourceDebtAmount: '5',
        protocolDebtBalance: '5.001',
        maxRepayBalance: '5.001',
      }),
    ).toEqual({
      referenceBalance: '5.001',
      repayAllTargetAmount: '5.001',
    });
  });

  it('keeps a wallet-capped repay max non-authoritative when debt is unknown', () => {
    expect(
      resolveProtocolLendingRepayDebtState({
        maxRepayBalance: '2',
      }),
    ).toEqual({
      referenceBalance: '2',
      repayAllTargetAmount: undefined,
    });
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

  it('shows remaining debt and wallet balance for repay with known debt', () => {
    expect(
      resolveProtocolLendingBalanceContext({
        isRepay: true,
        hasKnownDebt: true,
        walletBalance: '2',
      }),
    ).toEqual({
      primaryLabel: 'remainingDebt',
      secondaryWalletBalance: '2',
    });
  });

  it('uses the withdraw-specific label without a wallet balance row', () => {
    expect(
      resolveProtocolLendingBalanceContext({
        isRepay: false,
        hasKnownDebt: true,
        walletBalance: '2',
      }),
    ).toEqual({
      primaryLabel: 'availableToWithdraw',
      secondaryWalletBalance: undefined,
    });
  });

  it('keeps the neutral available label when repay debt is unknown', () => {
    expect(
      resolveProtocolLendingBalanceContext({
        isRepay: true,
        hasKnownDebt: false,
        walletBalance: '2',
      }),
    ).toEqual({
      primaryLabel: 'available',
      secondaryWalletBalance: '2',
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
