import {
  findSupportedBorrowMarket,
  resolveProtocolLendingRepayAmountState,
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

  it('falls back to referenceBalance for full-close when repayAllTargetAmount is missing', () => {
    const state = resolveProtocolLendingRepayAmountState({
      amount: '10',
      referenceBalance: '10',
    });
    expect(state.isFullClose).toBe(true);
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
