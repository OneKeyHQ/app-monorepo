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

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    RequestHardwareUIDialog: 'RequestHardwareUIDialog',
    ShowLinuxBundleUdevGuide: 'ShowLinuxBundleUdevGuide',
  },
  appEventBus: { emit: jest.fn() },
}));

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { act, renderHook } from '@testing-library/react-native';

import { Toast } from '@onekeyhq/components';
import { EHardwareUiStateAction } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  BluetoothUnavailableWhileUsbConnectedError,
  OneKeyHardwareError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { ONEKEY_WEBUSB_DEVICE_ACCESS_ERROR_CODE } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useOnboardingDeviceScanErrorHandler } from './useOnboardingDeviceScanErrorHandler';

const toastError = jest.mocked(Toast.error);
const requestHardwareUiDialog = jest.spyOn(appEventBus, 'emit');

describe('useOnboardingDeviceScanErrorHandler', () => {
  beforeEach(() => {
    toastError.mockClear();
    requestHardwareUiDialog.mockClear();
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

  it('routes a powered-off scan error to the existing Bluetooth settings dialog', () => {
    const stopScan = jest.fn();
    const { result } = renderHook(() =>
      useOnboardingDeviceScanErrorHandler({ stopScan }),
    );
    const error = convertDeviceError({
      code: HardwareErrorCode.BlePoweredOff,
      error: 'Bluetooth is powered off',
    });
    if (!(error instanceof OneKeyHardwareError)) {
      throw new OneKeyLocalError('Expected a converted SDK error instance');
    }

    act(() => {
      result.current.handleScanError(error);
    });

    expect(stopScan).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
    expect(requestHardwareUiDialog).toHaveBeenCalledTimes(1);
    expect(requestHardwareUiDialog).toHaveBeenCalledWith(
      EAppEventBusNames.RequestHardwareUIDialog,
      { uiRequestType: EHardwareUiStateAction.BLUETOOTH_PERMISSION },
    );
  });

  it.each([
    [HardwareErrorCode.BleLocationError],
    [HardwareErrorCode.BleLocationServicesDisabled],
  ])(
    'leaves the SDK permission dialog as the only notice for code %s',
    (code) => {
      const stopScan = jest.fn();
      const { result } = renderHook(() =>
        useOnboardingDeviceScanErrorHandler({ stopScan }),
      );
      const error = convertDeviceError({ code });
      if (!(error instanceof OneKeyHardwareError)) {
        throw new OneKeyLocalError('Expected a converted SDK error instance');
      }

      act(() => {
        result.current.handleScanError(error);
      });

      expect(stopScan).toHaveBeenCalledTimes(1);
      expect(toastError).not.toHaveBeenCalled();
      expect(requestHardwareUiDialog).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      HardwareErrorCode.BleUnsupported,
      ETranslations.hardware_third_party_transport_not_available,
    ],
    [
      HardwareErrorCode.BridgeNeedsPermission,
      ETranslations.device_grant_usb_access,
    ],
    [
      ONEKEY_WEBUSB_DEVICE_ACCESS_ERROR_CODE,
      ETranslations.global_connection_failed_usb_help_text,
    ],
  ])('preserves the recovery message for transport error %s', (code, title) => {
    const stopScan = jest.fn();
    const { result } = renderHook(() =>
      useOnboardingDeviceScanErrorHandler({ stopScan }),
    );
    const error = convertDeviceError({ code });
    if (!(error instanceof OneKeyHardwareError)) {
      throw new OneKeyLocalError('Expected a converted SDK error instance');
    }

    act(() => {
      result.current.handleScanError(error);
    });

    expect(stopScan).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith({ title });
    expect(requestHardwareUiDialog).not.toHaveBeenCalled();
  });

  it('leaves Linux USB permission guidance to the recovery service', () => {
    const originalIsDesktopLinux = platformEnv.isDesktopLinux;
    platformEnv.isDesktopLinux = true;
    try {
      const stopScan = jest.fn();
      const { result } = renderHook(() =>
        useOnboardingDeviceScanErrorHandler({ stopScan }),
      );
      const error = convertDeviceError({
        code: HardwareErrorCode.BridgeNeedsPermission,
      });
      if (!(error instanceof OneKeyHardwareError)) {
        throw new OneKeyLocalError('Expected a converted SDK error instance');
      }

      act(() => {
        result.current.handleScanError(error);
      });

      expect(stopScan).toHaveBeenCalledTimes(1);
      expect(toastError).not.toHaveBeenCalled();
      expect(requestHardwareUiDialog).not.toHaveBeenCalled();
    } finally {
      platformEnv.isDesktopLinux = originalIsDesktopLinux;
    }
  });
});
