import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';

import { showPrimeInfiniPaymentErrorToast } from './primeInfiniPaymentError';

const mockToastError = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    error: (...args: unknown[]) => {
      mockToastError(...args);
    },
  },
}));

describe('showPrimeInfiniPaymentErrorToast', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('preserves the original meaning while scrubbing secrets', () => {
    const error = Object.assign(
      new Error('payment failed for user@example.com token=secret-token'),
      {
        config: {
          headers: {
            Authorization: 'Bearer should-never-be-logged',
          },
        },
      },
    );

    showPrimeInfiniPaymentErrorToast({
      error,
      fallbackMessage: 'Payment failed',
    });

    expect(mockToastError).toHaveBeenCalledWith({
      title: 'payment failed for [email] token=[redacted]',
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[PrimeInfiniPayment] payment failed for [email] token=[redacted]',
    );
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain(
      'should-never-be-logged',
    );
    expect(error.$$autoToastErrorTriggered).toBe(true);
  });

  it('does not surface a user cancellation as an error', () => {
    showPrimeInfiniPaymentErrorToast({
      error: {
        className: EOneKeyErrorClassNames.OAuthLoginCancelError,
      },
      fallbackMessage: 'Payment failed',
    });

    expect(mockToastError).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
