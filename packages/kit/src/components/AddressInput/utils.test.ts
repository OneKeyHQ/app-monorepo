import { shouldShowAddressQuerySpinner } from './utils';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

describe('shouldShowAddressQuerySpinner', () => {
  it('never shows the spinner when idle', () => {
    expect(shouldShowAddressQuerySpinner({ loading: false, result: {} })).toBe(
      false,
    );
    expect(shouldShowAddressQuerySpinner({ loading: undefined })).toBe(false);
  });

  it('shows the spinner for the first query of an input', () => {
    expect(shouldShowAddressQuerySpinner({ loading: true })).toBe(true);
    expect(shouldShowAddressQuerySpinner({ loading: true, result: {} })).toBe(
      true,
    );
  });

  it('keeps the previous badges while re-validating the same input', () => {
    expect(
      shouldShowAddressQuerySpinner({
        loading: true,
        result: {
          input: '0xabc',
          validStatus: 'valid',
          walletAccountName: 'Wallet / Account #1',
        },
      }),
    ).toBe(false);
  });

  it('shows the spinner when retrying after an unknown status', () => {
    expect(
      shouldShowAddressQuerySpinner({
        loading: true,
        result: { input: '0xabc', validStatus: 'unknown' },
      }),
    ).toBe(true);
  });
});
