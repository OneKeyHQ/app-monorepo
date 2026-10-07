/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { renderHook } from '@testing-library/react';
import { IntlProvider, createIntl } from 'react-intl';

import { BluetoothUnavailableWhileUsbConnectedError } from '@onekeyhq/shared/src/errors';
import { FirmwareUpdateTransferInterruptedError } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import {
  EOneKeyErrorClassNames,
  type IOneKeyError,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useFirmwareUpdateErrors as useLegacyFirmwareUpdateErrors } from './components/FirmwareUpdateErrors';
import { resolveFirmwareUpdateErrorPresentation } from './componentsV2/firmwareUpdateErrorPresentation';

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('./components/FirmwareUpdatePageLayout', () => ({
  FirmwareUpdatePageFooter: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/HyperlinkText', () => ({
  HyperlinkText: () => null,
}));

const usbPriorityMessage = 'Disconnect USB to continue using Bluetooth.';
const deviceDisconnectedMessage =
  'The device has been disconnected. Please reconnect the device and try again.';
const deviceDisconnectedTitle = 'Device disconnected';
const operationTimedOutMessage = 'Operation timed out';
const deviceMismatchMessage =
  'The connected device does not match this wallet. Reconnect the correct device, or add it again after a reset or recovery.';
const genericErrorTitle = 'An error occurred';

const intlMessages: Record<string, string> = {
  [ETranslations.troubleshooting_desktop_bluetooth_usb_priority]:
    usbPriorityMessage,
  [ETranslations.firmware_update_device_mismatch__desc]: deviceMismatchMessage,
  [ETranslations.global_an_error_occurred]: genericErrorTitle,
  [ETranslations.hardware_third_party_device_disconnected]:
    deviceDisconnectedTitle,
  [ETranslations.update_device_disconnected_desc]: deviceDisconnectedMessage,
  [ETranslations.hardware_third_party_operation_timeout]:
    operationTimedOutMessage,
  [ETranslations.global_update_failed]: 'Update failed',
  [ETranslations.firmware_update_error_transfer_interrupted]:
    'Transfer interrupted. Please keep your device connected and try again.',
  [ETranslations.global_retry]: 'Retry',
};

const intl = createIntl({ locale: 'en', messages: intlMessages });

function IntlWrapper({ children }: { children: ReactNode }) {
  return (
    <IntlProvider locale="en" messages={intlMessages}>
      {children as never}
    </IntlProvider>
  );
}

describe('firmware update USB-priority errors', () => {
  const error = new BluetoothUnavailableWhileUsbConnectedError();

  it('uses the localized USB-priority message on the install page', () => {
    const presentation = resolveFirmwareUpdateErrorPresentation({
      error,
      result: undefined,
      lastFirmwareTipMessage: undefined,
      intl,
    });

    expect(error.code).toBe(HardwareErrorCode.BleUnavailableWhileUsbConnected);
    expect(presentation.sentence).toBe(usbPriorityMessage);
    expect(presentation.action).toEqual({ kind: 'retry' });
  });

  it('uses the localized USB-priority message in the legacy error view', () => {
    const { result } = renderHook(
      () =>
        useLegacyFirmwareUpdateErrors({
          error,
          lastFirmwareTipMessage: undefined,
          onRetry: undefined,
          result: undefined,
        }),
      { wrapper: IntlWrapper },
    );
    const content = result.current.content as ReactElement<{
      message?: string;
    }>;

    expect(content.props.message).toBe(usbPriorityMessage);
  });
});

describe('firmware update cancellation errors', () => {
  const error: IOneKeyError = {
    className: EOneKeyErrorClassNames.FirmwareUpdateTasksClear,
    message: 'updateTasksClear: exitUpdateWorkflow',
  };

  it('does not expose exitUpdateWorkflow on the install page', () => {
    const presentation = resolveFirmwareUpdateErrorPresentation({
      error,
      result: undefined,
      lastFirmwareTipMessage: undefined,
      intl,
    });

    expect(presentation.title).toBe(deviceDisconnectedTitle);
    expect(presentation.sentence).toBe(deviceDisconnectedMessage);
  });

  it('does not expose exitUpdateWorkflow in the legacy error view', () => {
    const { result } = renderHook(
      () =>
        useLegacyFirmwareUpdateErrors({
          error,
          lastFirmwareTipMessage: undefined,
          onRetry: undefined,
          result: undefined,
        }),
      { wrapper: IntlWrapper },
    );
    const content = result.current.content as ReactElement<{
      message?: string;
      title?: string;
    }>;

    expect(content.props.title).toBe(deviceDisconnectedTitle);
    expect(content.props.message).toBe(deviceDisconnectedMessage);
  });
});

describe('firmware update timeout errors', () => {
  it('localizes the Protocol V2 install timeout instead of exposing SDK text', () => {
    const error: IOneKeyError = {
      message: 'Protocol V2 firmware install timed out',
    };
    const presentation = resolveFirmwareUpdateErrorPresentation({
      error,
      result: undefined,
      lastFirmwareTipMessage: undefined,
      intl,
    });

    expect(presentation.sentence).toBe(operationTimedOutMessage);
  });
});

describe('firmware update device mismatch errors', () => {
  const error: IOneKeyError = {
    className: EOneKeyErrorClassNames.OneKeyHardwareError,
    $isHardwareError: true,
    code: HardwareErrorCode.DeviceCheckDeviceIdError,
    message: 'Device id mismatch',
  };

  it('uses the localized mismatch message instead of the SDK sentence', () => {
    const presentation = resolveFirmwareUpdateErrorPresentation({
      error,
      result: undefined,
      lastFirmwareTipMessage: undefined,
      intl,
    });

    expect(presentation.title).toBe(genericErrorTitle);
    expect(presentation.sentence).toBe(deviceMismatchMessage);
    expect(presentation.action).toEqual({ kind: 'retry' });
  });
});

describe('firmware update transfer interrupted errors', () => {
  it('localizes a stalled firmware transfer instead of hanging silently', () => {
    const error = new FirmwareUpdateTransferInterruptedError();
    const presentation = resolveFirmwareUpdateErrorPresentation({
      error,
      result: undefined,
      lastFirmwareTipMessage: undefined,
      intl,
    });

    expect(error.code).toBe(HardwareErrorCode.EmmcFileWriteFirmwareError);
    expect(presentation.sentence).toBe(
      'Transfer interrupted. Please keep your device connected and try again.',
    );
    expect(presentation.action).toEqual({ kind: 'retry' });
  });
});
