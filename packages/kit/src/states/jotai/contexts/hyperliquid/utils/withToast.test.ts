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
import { hyperLiquidErrorResolver } from '@onekeyhq/shared/src/utils/hyperLiquidErrorResolver';

import { EActionType } from './types';
import { withToast } from './withToast';

const toastErrorSpy = jest.spyOn(Toast, 'error').mockImplementation(jest.fn());

describe('withToast', () => {
  afterEach(() => {
    hyperLiquidErrorResolver.updateLocales(undefined);
    toastErrorSpy.mockClear();
    jest.clearAllTimers();
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
