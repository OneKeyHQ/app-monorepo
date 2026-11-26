/* eslint-disable import/first */

jest.mock('@onekeyhq/components', () => ({
  __esModule: true,
  Toast: {
    error: jest.fn(),
    loading: jest.fn(() => ({ close: jest.fn() })),
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
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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

  it('closes the loading card and shows a separate order result', async () => {
    jest.useFakeTimers();
    const success = jest.spyOn(Toast, 'success');
    try {
      const close = jest.fn();
      jest.mocked(Toast.loading).mockReturnValueOnce({ close });
      const task = withToast({
        actionType: EActionType.PLACE_ORDER,
        asyncFn: async () =>
          new Promise<void>((resolve) => {
            setTimeout(resolve, 500);
          }),
      });

      await jest.advanceTimersByTimeAsync(500);
      await task;
      expect(close).toHaveBeenCalledTimes(1);
      expect(success).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.any(String) }),
      );
    } finally {
      success.mockRestore();
      jest.useRealTimers();
    }
  });

  it('closes the loading card and shows an order error while the locale lookup is pending', async () => {
    jest.useFakeTimers();
    const locale = Promise.withResolvers<{
      localizedMessage: string;
      rawMessage: string;
    }>();
    const lookup = jest
      .spyOn(hyperLiquidErrorResolver, 'resolveAsync')
      .mockReturnValue(locale.promise);
    try {
      const close = jest.fn();
      jest.mocked(Toast.loading).mockReturnValueOnce({ close });
      const operation = Promise.withResolvers<void>();
      const error = new Error('Price too far from oracle');
      const result = withToast({
        actionType: EActionType.PLACE_ORDER,
        asyncFn: () => operation.promise,
      });

      await jest.advanceTimersByTimeAsync(300);
      operation.reject(error);
      await expect(result).rejects.toBe(error);
      expect(close).toHaveBeenCalledTimes(1);
      expect(toastErrorSpy).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(300);
      expect(toastErrorSpy).toHaveBeenCalledWith({ title: error.message });

      locale.resolve({
        rawMessage: error.message,
        localizedMessage: 'Too far',
      });
      await jest.advanceTimersByTimeAsync(0);
      expect(toastErrorSpy).toHaveBeenCalledTimes(1);
    } finally {
      lookup.mockRestore();
      jest.useRealTimers();
    }
  });

  it.each([false, true])(
    'closes the loading toast and preserves the rejection if error extraction throws (getter throws=%s)',
    async (getterThrows) => {
      jest.useFakeTimers();
      const diagnostic = jest
        .spyOn(defaultLogger.perp.agentLifeCycle, 'trackReason')
        .mockImplementation((params) => params);
      try {
        const close = jest.fn();
        jest.mocked(Toast.loading).mockReturnValueOnce({ close });
        const operation = Promise.withResolvers<void>();
        const unprintable = Object.create(null) as object;
        const error = getterThrows
          ? {
              get response(): never {
                throw unprintable;
              },
            }
          : { message: unprintable };
        const result = withToast({
          actionType: EActionType.PLACE_ORDER,
          asyncFn: () => operation.promise,
        });

        await jest.advanceTimersByTimeAsync(300);
        operation.reject(error);
        await expect(result).rejects.toBe(error);
        await jest.advanceTimersByTimeAsync(0);
        expect(close).toHaveBeenCalledTimes(1);
        expect(toastErrorSpy).not.toHaveBeenCalled();
        expect(diagnostic).toHaveBeenCalledWith({
          reason: 'runtime_handle_error_failed',
          statusDetails: {
            errorMessage: getterThrows
              ? 'Unable to format error'
              : expect.any(String),
          },
        });
      } finally {
        diagnostic.mockRestore();
        jest.useRealTimers();
      }
    },
  );

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
