import { shouldOfferSwapDepositAction } from './swapDepositActionUtils';

const ready = {
  balance: '0',
  hasBalanceError: false,
  hasFromToken: true,
  hasToToken: true,
  hasFromAddress: true,
  noConnectWallet: false,
  noProviderSupportsTrade: false,
  isStockBalanceUnavailable: false,
};

describe('shouldOfferSwapDepositAction', () => {
  it('offers deposit for a loaded zero balance, even before an amount', () => {
    expect(shouldOfferSwapDepositAction(ready)).toBe(true);
    expect(shouldOfferSwapDepositAction({ ...ready, balance: '0.0' })).toBe(
      true,
    );
  });

  it('keeps the insufficient label for a partial balance', () => {
    expect(shouldOfferSwapDepositAction({ ...ready, balance: '0.5' })).toBe(
      false,
    );
  });

  it('waits until the balance has loaded', () => {
    expect(shouldOfferSwapDepositAction({ ...ready, balance: '' })).toBe(false);
    expect(shouldOfferSwapDepositAction({ ...ready, balance: undefined })).toBe(
      false,
    );
    expect(
      shouldOfferSwapDepositAction({
        ...ready,
        balance: '0.0',
        hasBalanceError: true,
      }),
    ).toBe(false);
    expect(shouldOfferSwapDepositAction({ ...ready, balance: 'n/a' })).toBe(
      false,
    );
  });

  it('lets the form-completion and connection states win', () => {
    expect(
      shouldOfferSwapDepositAction({ ...ready, hasFromToken: false }),
    ).toBe(false);
    expect(shouldOfferSwapDepositAction({ ...ready, hasToToken: false })).toBe(
      false,
    );
    expect(
      shouldOfferSwapDepositAction({ ...ready, hasFromAddress: false }),
    ).toBe(false);
    expect(
      shouldOfferSwapDepositAction({ ...ready, noConnectWallet: true }),
    ).toBe(false);
  });

  it('lets unsupported pairs and stock balance gaps win', () => {
    expect(
      shouldOfferSwapDepositAction({ ...ready, noProviderSupportsTrade: true }),
    ).toBe(false);
    expect(
      shouldOfferSwapDepositAction({
        ...ready,
        isStockBalanceUnavailable: true,
      }),
    ).toBe(false);
  });
});
