/* eslint-disable import/first */

jest.mock('@onekeyhq/components', () => ({
  __esModule: true,
  Toast: {
    error: jest.fn(),
    loading: jest.fn(() => ({ close: jest.fn(), settle: jest.fn(() => true) })),
    success: jest.fn(),
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      checkPerpsAccountStatus: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  __esModule: true,
  appLocale: {
    intl: {
      formatMessage: ({ id }: { id: string }) => id,
    },
  },
}));

import { waitFor } from '@testing-library/react-native';

import { Toast } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { hyperLiquidErrorResolver } from '@onekeyhq/shared/src/utils/hyperLiquidErrorResolver';

import { getPerpsTradingNotEnabledMessage } from './config';
import { EActionType } from './types';
import { withToast } from './withToast';

const toastErrorSpy = jest.spyOn(Toast, 'error').mockImplementation(jest.fn());

describe('withToast', () => {
  afterEach(() => {
    hyperLiquidErrorResolver.updateLocales(undefined);
    toastErrorSpy.mockClear();
    jest.clearAllTimers();
  });

  it('localizes the trading-not-enabled guard message', () => {
    expect(getPerpsTradingNotEnabledMessage()).toBe('perp.error_enable');
  });

  it.each([true, false])(
    'shows an order result after a loading card (in place=%s)',
    async (canSettle) => {
      jest.useFakeTimers();
      try {
        const close = jest.fn();
        const settle = jest.fn(() => canSettle);
        jest.mocked(Toast.loading).mockReturnValueOnce({ close, settle });
        const success = jest.spyOn(Toast, 'success');
        const task = withToast({
          actionType: EActionType.PLACE_ORDER,
          asyncFn: async () =>
            new Promise<void>((resolve) => {
              setTimeout(resolve, 500);
            }),
        });

        await jest.advanceTimersByTimeAsync(500);
        await task;
        if (!canSettle) {
          expect(close).toHaveBeenCalledTimes(1);
          expect(success).toHaveBeenCalledWith(
            expect.objectContaining({ title: expect.any(String) }),
          );
        } else {
          expect(close).not.toHaveBeenCalled();
          expect(success).not.toHaveBeenCalled();
        }
        expect(settle).toHaveBeenCalledWith(
          'success',
          expect.objectContaining({ title: expect.any(String) }),
          { onlyIfFrontmostOnWeb: true },
        );
        success.mockRestore();
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it('settles an order error while the locale lookup is pending', async () => {
    jest.useFakeTimers();
    const locale = Promise.withResolvers<{
      localizedMessage: string;
      rawMessage: string;
    }>();
    const lookup = jest
      .spyOn(hyperLiquidErrorResolver, 'resolveAsync')
      .mockReturnValue(locale.promise);
    try {
      const settle = jest.fn(() => true);
      jest
        .mocked(Toast.loading)
        .mockReturnValueOnce({ close: jest.fn(), settle });
      const operation = Promise.withResolvers<void>();
      const error = new Error('Price too far from oracle');
      const result = withToast({
        actionType: EActionType.PLACE_ORDER,
        asyncFn: () => operation.promise,
      });

      await jest.advanceTimersByTimeAsync(300);
      operation.reject(error);
      await expect(result).rejects.toBe(error);
      await jest.advanceTimersByTimeAsync(300);
      expect(settle).toHaveBeenCalledWith(
        'error',
        { title: error.message },
        { onlyIfFrontmostOnWeb: true },
      );

      locale.resolve({
        rawMessage: error.message,
        localizedMessage: 'Too far',
      });
      await jest.advanceTimersByTimeAsync(0);
      expect(settle).toHaveBeenCalledTimes(1);
    } finally {
      lookup.mockRestore();
      jest.useRealTimers();
    }
  });

  it('closes the loading toast and preserves the rejection if error extraction throws', async () => {
    jest.useFakeTimers();
    try {
      const close = jest.fn();
      const settle = jest.fn(() => true);
      jest.mocked(Toast.loading).mockReturnValueOnce({ close, settle });
      const operation = Promise.withResolvers<void>();
      const error = { message: Object.create(null) as object };
      const result = withToast({
        actionType: EActionType.PLACE_ORDER,
        asyncFn: () => operation.promise,
      });

      await jest.advanceTimersByTimeAsync(300);
      operation.reject(error);
      await expect(result).rejects.toBe(error);
      await jest.advanceTimersByTimeAsync(0);
      expect(close).toHaveBeenCalledTimes(1);
      expect(settle).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('localizes wrapped HyperLiquid order errors from server config', async () => {
    const wrappedMessage =
      'Failed to place market order open: ApiRequestError: Order 0: Insufficient margin to place order. asset=0';

    hyperLiquidErrorResolver.updateLocales([
      {
        i18nKey: 'perps_error__no_insufficient_margin',
        rawMessage: wrappedMessage,
        localizedMessage:
          'Insufficient margin. Please deposit funds to continue.',
        variables: [],
        matcher: {
          type: 'exact',
          value: wrappedMessage,
        },
      },
    ]);

    await expect(
      withToast({
        actionType: EActionType.PLACE_ORDER,
        asyncFn: async () => {
          throw new OneKeyLocalError(wrappedMessage);
        },
      }),
    ).rejects.toThrow(wrappedMessage);

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith({
        title: 'Insufficient margin. Please deposit funds to continue.',
      });
    });
  });

  it('falls back to extracted business messages for unconfigured order errors', async () => {
    const wrappedMessage =
      'Failed to place market order open: ApiRequestError: Order 0: Price too far from oracle asset=110029';

    await expect(
      withToast({
        actionType: EActionType.PLACE_ORDER,
        asyncFn: async () => {
          throw new OneKeyLocalError(wrappedMessage);
        },
      }),
    ).rejects.toThrow(wrappedMessage);

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith({
        title: 'Price too far from oracle',
      });
    });
  });

  it('localizes extracted HyperLiquid response errors', async () => {
    hyperLiquidErrorResolver.updateLocales([
      {
        i18nKey: 'perp_price_too_far',
        rawMessage: 'Price too far from oracle',
        localizedMessage: 'Price is too far from oracle.',
        variables: [],
        matcher: {
          type: 'exact',
          value: 'Price too far from oracle',
        },
      },
    ]);

    await expect(
      withToast({
        actionType: EActionType.PLACE_ORDER,
        asyncFn: async () => {
          const error = new OneKeyLocalError('Request failed');
          Object.assign(error, {
            response: {
              status: 'err',
              response: 'Price too far from oracle',
            },
          });
          throw error;
        },
      }),
    ).rejects.toThrow('Request failed');

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith({
        title: 'Price is too far from oracle.',
      });
    });
  });
});
