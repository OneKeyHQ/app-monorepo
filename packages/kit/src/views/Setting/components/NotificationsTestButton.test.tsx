/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ENotificationPermission } from '@onekeyhq/shared/types/notification';
import type {
  INotificationPermissionDetail,
  INotificationShowResult,
} from '@onekeyhq/shared/types/notification';

import NotificationsTestButton from './NotificationsTestButton';

const mockGetPermissionWithoutLog = jest.fn<
  Promise<INotificationPermissionDetail>,
  unknown[]
>();
const mockOpenPermissionSettings = jest.fn<Promise<void>, unknown[]>();
const mockRequestPermission = jest.fn<
  Promise<INotificationPermissionDetail>,
  unknown[]
>();
const mockShowNotification = jest.fn<
  Promise<INotificationShowResult>,
  unknown[]
>();
let mockOnAppActive: (() => void) | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    Button: ({
      children,
      disabled,
      loading,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      disabled?: boolean;
      loading?: boolean;
      onPress?: () => void;
      testID?: string;
    }) =>
      React.createElement(
        'button',
        {
          'data-testid': testID,
          disabled: disabled || loading,
          onClick: onPress,
        },
        children,
      ),
    YStack: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNotification: {
      getPermissionWithoutLog: (...args: unknown[]) =>
        mockGetPermissionWithoutLog(...args),
      openPermissionSettings: (...args: unknown[]) =>
        mockOpenPermissionSettings(...args),
      requestPermission: (...args: unknown[]) => mockRequestPermission(...args),
      showNotification: (...args: unknown[]) => mockShowNotification(...args),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useHandleAppStateActive', () => ({
  useHandleAppStateActive: (handler?: () => void) => {
    mockOnAppActive = handler;
  },
}));

describe('NotificationsTestButton', () => {
  beforeEach(() => {
    mockGetPermissionWithoutLog.mockReset();
    mockOpenPermissionSettings.mockReset();
    mockRequestPermission.mockReset();
    mockShowNotification.mockReset();
    mockOpenPermissionSettings.mockResolvedValue(undefined);
    mockShowNotification.mockResolvedValue({ notificationId: 'test' });
    mockOnAppActive = undefined;
  });

  it('requests an undecided iOS permission before enabling preview', async () => {
    mockGetPermissionWithoutLog.mockResolvedValue({
      isSupported: true,
      permission: ENotificationPermission.default,
    });
    mockRequestPermission.mockResolvedValue({
      isSupported: true,
      permission: ENotificationPermission.granted,
    });

    render(<NotificationsTestButton showPermissionAction />);

    await waitFor(() => {
      expect(screen.getByText(ETranslations.global_enable)).toBeTruthy();
    });
    expect(screen.getByTestId('setting-intl-btn')).toHaveProperty(
      'disabled',
      true,
    );

    fireEvent.click(screen.getByText(ETranslations.global_enable));

    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(ETranslations.global_enable)).toBeNull();
      expect(screen.getByTestId('setting-intl-btn')).toHaveProperty(
        'disabled',
        false,
      );
    });
    expect(mockOpenPermissionSettings).not.toHaveBeenCalled();
  });

  it('opens Settings after denial and refreshes permission on app resume', async () => {
    mockGetPermissionWithoutLog.mockResolvedValue({
      isSupported: true,
      permission: ENotificationPermission.denied,
    });
    render(<NotificationsTestButton showPermissionAction />);

    await waitFor(() => {
      expect(
        screen.getByText(ETranslations.global_go_to_settings),
      ).toBeTruthy();
    });
    fireEvent.click(screen.getByText(ETranslations.global_go_to_settings));

    await waitFor(() => {
      expect(mockOpenPermissionSettings).toHaveBeenCalledTimes(1);
    });
    expect(mockRequestPermission).not.toHaveBeenCalled();

    mockGetPermissionWithoutLog.mockResolvedValue({
      isSupported: true,
      permission: ENotificationPermission.granted,
    });
    act(() => {
      mockOnAppActive?.();
    });

    await waitFor(() => {
      expect(
        screen.queryByText(ETranslations.global_go_to_settings),
      ).toBeNull();
      expect(screen.getByTestId('setting-intl-btn')).toHaveProperty(
        'disabled',
        false,
      );
    });
  });

  it('shows a local preview without checking permission on other platforms', () => {
    render(<NotificationsTestButton />);

    fireEvent.click(screen.getByText(ETranslations.global_test));

    expect(mockShowNotification).toHaveBeenCalledTimes(1);
    expect(mockGetPermissionWithoutLog).not.toHaveBeenCalled();
  });
});
