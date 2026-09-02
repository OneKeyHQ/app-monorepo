/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('react-native', () => ({
  Linking: { openURL: jest.fn() },
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: { confirm: jest.fn() },
  Stack: jest.fn(),
  Toast: { error: jest.fn() },
}));

jest.mock('@onekeyhq/kit/src/components/HyperlinkText', () => ({
  HyperlinkText: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isSupportWebUSB: false },
}));

import { act, renderHook } from '@testing-library/react-native';

import { Toast } from '@onekeyhq/components';
import {
  BluetoothUnavailableWhileUsbConnectedError,
  DeviceBondError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useOnboardingDeviceScanErrorHandler } from './useOnboardingDeviceScanErrorHandler';

const toastError = jest.mocked(Toast.error);

describe('useOnboardingDeviceScanErrorHandler', () => {
  beforeEach(() => {
    toastError.mockClear();
  });

  it('keeps scanning and de-duplicates the USB conflict toast', () => {
    const stopScan = jest.fn();
    const { result } = renderHook(() =>
      useOnboardingDeviceScanErrorHandler({ stopScan }),
    );
    const error = new BluetoothUnavailableWhileUsbConnectedError();

    act(() => {
      result.current.handleScanError(error);
      result.current.handleScanError(error);
    });

    expect(stopScan).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('allows the USB conflict toast again after a successful scan', () => {
    const { result } = renderHook(() =>
      useOnboardingDeviceScanErrorHandler({ stopScan: jest.fn() }),
    );
    const error = new BluetoothUnavailableWhileUsbConnectedError();

    act(() => {
      result.current.handleScanError(error);
      result.current.resetScanError();
      result.current.handleScanError(error);
    });

    expect(toastError).toHaveBeenCalledTimes(2);
  });

  it('stops scanning after a terminal error', () => {
    const stopScan = jest.fn();
    const { result } = renderHook(() =>
      useOnboardingDeviceScanErrorHandler({ stopScan }),
    );

    act(() => {
      result.current.handleScanError(new Error('transport unavailable'));
    });

    expect(stopScan).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith({
      title: ETranslations.device_communication_failed,
    });
  });

  it('does not duplicate the global dialog for a Bluetooth bond error', () => {
    const stopScan = jest.fn();
    const { result } = renderHook(() =>
      useOnboardingDeviceScanErrorHandler({ stopScan }),
    );

    act(() => {
      result.current.handleScanError(new DeviceBondError());
    });

    expect(stopScan).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });
});
