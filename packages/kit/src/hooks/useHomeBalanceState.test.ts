import { resolveHomeBalanceState } from './useHomeBalanceState';

describe('resolveHomeBalanceState', () => {
  it('does not guess zero before the balance owner is ready', () => {
    expect(
      resolveHomeBalanceState({
        hasWallet: true,
        hasHoldings: false,
        balanceIsPositive: undefined,
      }),
    ).toBe('unknown');
  });

  it('treats unpriced holdings as positive', () => {
    expect(
      resolveHomeBalanceState({
        hasWallet: true,
        hasHoldings: true,
        balanceIsPositive: false,
      }),
    ).toBe('positive');
  });

  it('resolves zero only from an authoritative balance result', () => {
    expect(
      resolveHomeBalanceState({
        hasWallet: true,
        hasHoldings: false,
        balanceIsPositive: false,
      }),
    ).toBe('zero');
  });
});
