/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getErrorAction } from './ErrorToasts';

const mockOpenBLESettings = jest.fn();
const mockOpenDesktopBluetoothSettings = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button data-testid={testID} onClick={onPress} type="button">
      {children}
    </button>
  ),
  Dialog: {
    show: jest.fn(),
  },
  Toast: {
    dismiss: jest.fn(),
    success: jest.fn(),
  },
  rootNavigationRef: {
    current: null,
  },
  useClipboard: () => ({ copyText: jest.fn() }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/shared/src/hardware/blePermissions', () => ({
  openBLESettings: () => {
    mockOpenBLESettings();
  },
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom', () => ({
  showIntercom: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: false,
    isNative: true,
  },
}));

jest.mock(
  '../../../views/FirmwareUpdate/hooks/useFirmwareUpdateActions',
  () => ({
    useFirmwareUpdateActions: () => ({
      openChangeLogModal: jest.fn(),
    }),
  }),
);

describe('getErrorAction Bluetooth pairing recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(platformEnv, {
      isDesktop: false,
      isNative: true,
    });
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        bluetooth: {
          openBluetoothSettings: mockOpenDesktopBluetoothSettings,
        },
      },
    });
  });

  it('opens native Bluetooth settings for an invalid bond', () => {
    const action = getErrorAction({
      i18nKey: ETranslations.feedback_try_repairing_device_in_settings,
    });
    const { getByTestId } = render(<>{action}</>);

    fireEvent.click(getByTestId('error-toast-open-bluetooth-settings-btn'));

    expect(mockOpenBLESettings).toHaveBeenCalledTimes(1);
    expect(mockOpenDesktopBluetoothSettings).not.toHaveBeenCalled();
  });

  it('opens desktop Bluetooth settings for an invalid bond', () => {
    Object.assign(platformEnv, {
      isDesktop: true,
      isNative: false,
    });
    const action = getErrorAction({
      i18nKey: ETranslations.feedback_try_repairing_device_in_settings,
    });
    const { getByTestId } = render(<>{action}</>);

    fireEvent.click(getByTestId('error-toast-open-bluetooth-settings-btn'));

    expect(mockOpenDesktopBluetoothSettings).toHaveBeenCalledTimes(1);
    expect(mockOpenBLESettings).not.toHaveBeenCalled();
  });
});
