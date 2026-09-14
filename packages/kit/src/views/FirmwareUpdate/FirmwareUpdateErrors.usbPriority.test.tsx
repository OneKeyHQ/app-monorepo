/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { renderHook } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import { BluetoothUnavailableWhileUsbConnectedError } from '@onekeyhq/shared/src/errors';
import {
  EOneKeyErrorClassNames,
  type IOneKeyError,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useFirmwareUpdateErrors as useLegacyFirmwareUpdateErrors } from './components/FirmwareUpdateErrors';
import { useFirmwareUpdateErrors as useFirmwareUpdateErrorsV2 } from './componentsV2/FirmwareUpdateErrorV2';

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

const intlMessages: Record<string, string> = {
  [ETranslations.troubleshooting_desktop_bluetooth_usb_priority]:
    usbPriorityMessage,
  [ETranslations.hardware_third_party_device_disconnected]:
    deviceDisconnectedTitle,
  [ETranslations.update_device_disconnected_desc]: deviceDisconnectedMessage,
  [ETranslations.hardware_third_party_operation_timeout]:
    operationTimedOutMessage,
  [ETranslations.global_retry]: 'Retry',
};

function IntlWrapper({ children }: { children: ReactNode }) {
  return (
    <IntlProvider locale="en" messages={intlMessages}>
      {children as never}
    </IntlProvider>
  );
}

describe('firmware update USB-priority errors', () => {
  const error = new BluetoothUnavailableWhileUsbConnectedError();

  it('uses the localized USB-priority message in the Protocol V2 error view', () => {
    const { result } = renderHook(
      () =>
        useFirmwareUpdateErrorsV2({
          error,
          lastFirmwareTipMessage: undefined,
        }),
      { wrapper: IntlWrapper },
    );

    expect(error.code).toBe(HardwareErrorCode.BleUnavailableWhileUsbConnected);
    expect(result.current.errorMessage).toBe(usbPriorityMessage);
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

  it('does not expose exitUpdateWorkflow in the Protocol V2 error view', () => {
    const { result } = renderHook(
      () =>
        useFirmwareUpdateErrorsV2({
          error,
          lastFirmwareTipMessage: undefined,
        }),
      { wrapper: IntlWrapper },
    );

    expect(result.current.errorMessage).toBe(deviceDisconnectedMessage);
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
    const { result } = renderHook(
      () =>
        useFirmwareUpdateErrorsV2({
          error,
          lastFirmwareTipMessage: undefined,
        }),
      { wrapper: IntlWrapper },
    );

    expect(result.current.errorMessage).toBe(operationTimedOutMessage);
  });
});
