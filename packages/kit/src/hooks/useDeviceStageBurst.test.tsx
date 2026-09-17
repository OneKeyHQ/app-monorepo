/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  BluetoothUnavailableWhileUsbConnectedError,
  DeviceNotOpenedPassphrase,
} from '@onekeyhq/shared/src/errors';
import { isOneKeyHardwareError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useDeviceStageBurst } from './useDeviceStageBurst';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardwareUI: {
      deviceStageBeginBurst: jest.fn(async () => 1),
      deviceStageEndBurst: jest.fn(async () => undefined),
    },
  },
}));

describe('useDeviceStageBurst error transport', () => {
  it.each([
    BluetoothUnavailableWhileUsbConnectedError,
    DeviceNotOpenedPassphrase,
  ])('sends serializable details for %p', async (ErrorClass) => {
    const endBurst = jest.spyOn(
      backgroundApiProxy.serviceHardwareUI,
      'deviceStageEndBurst',
    );
    endBurst.mockClear();
    const { result, unmount } = renderHook(() => useDeviceStageBurst());
    const error = new ErrorClass();
    expect(Object.getOwnPropertyDescriptor(error, 'message')?.enumerable).toBe(
      false,
    );

    await act(async () => {
      await result.current.beginBurst();
      await result.current.endBurst({ error });
    });

    const request = JSON.parse(JSON.stringify(endBurst.mock.calls[0][0])) as {
      token: number;
      error: unknown;
    };
    expect(request).toMatchObject({
      token: 1,
      error: {
        message: error.message,
        key: error.key,
        code: error.code,
        className: error.className,
      },
    });
    expect(isOneKeyHardwareError(request.error)).toBe(true);
    unmount();
  });

  it('ends a burst with its localized success outcome in one request', async () => {
    const endBurst = jest.spyOn(
      backgroundApiProxy.serviceHardwareUI,
      'deviceStageEndBurst',
    );
    endBurst.mockClear();
    const { result, unmount } = renderHook(() => useDeviceStageBurst());

    await act(async () => {
      await result.current.beginBurst();
      await result.current.endBurst({
        doneI18n: { key: ETranslations.portfolio_updated__title },
      });
    });

    expect(endBurst).toHaveBeenCalledWith({
      token: 1,
      error: undefined,
      doneI18n: { key: ETranslations.portfolio_updated__title },
    });
    unmount();
  });
});
