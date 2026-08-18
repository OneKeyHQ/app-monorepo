/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { renderHook } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import { BluetoothUnavailableWhileUsbConnectedError } from '@onekeyhq/shared/src/errors';
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

function IntlWrapper({ children }: { children: ReactNode }) {
  return (
    <IntlProvider
      locale="en"
      messages={{
        [ETranslations.troubleshooting_desktop_bluetooth_usb_priority]:
          usbPriorityMessage,
        [ETranslations.global_retry]: 'Retry',
      }}
    >
      {children}
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
