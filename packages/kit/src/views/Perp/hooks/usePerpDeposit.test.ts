import { shouldWaitForPerpsDepositQuoteAccount } from './usePerpDepositUtils';

describe('shouldWaitForPerpsDepositQuoteAccount', () => {
  it('waits only while a valid deposit quote account is still loading', () => {
    expect(
      shouldWaitForPerpsDepositQuoteAccount({
        hasValidDepositQuoteInput: true,
        isDepositQuoteAccountLoading: true,
      }),
    ).toBe(true);
  });

  it('does not keep loading after account resolution finishes without an account', () => {
    expect(
      shouldWaitForPerpsDepositQuoteAccount({
        hasValidDepositQuoteInput: true,
        isDepositQuoteAccountLoading: false,
      }),
    ).toBe(false);
  });

  it('does not wait before the account loading state starts', () => {
    expect(
      shouldWaitForPerpsDepositQuoteAccount({
        hasValidDepositQuoteInput: true,
        isDepositQuoteAccountLoading: undefined,
      }),
    ).toBe(false);
  });

  it('does not wait when the quote input is invalid', () => {
    expect(
      shouldWaitForPerpsDepositQuoteAccount({
        hasValidDepositQuoteInput: false,
        isDepositQuoteAccountLoading: true,
      }),
    ).toBe(false);
  });
});
