/** @jest-environment jsdom */

import { fireEvent, render, waitFor } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ENotificationPermission } from '@onekeyhq/shared/types/notification';

import NotificationsTestButton from './NotificationsTestButton';

const mockShowNotification: jest.Mock<Promise<unknown>, unknown[]> = jest.fn();
const mockRecover: jest.Mock<Promise<unknown>, unknown[]> = jest.fn();
const mockCanSend: jest.Mock<Promise<boolean>, unknown[]> = jest.fn();
const mockReload: jest.Mock<Promise<void>, unknown[]> = jest.fn();

let mockPermission:
  | {
      isSupported: boolean;
      permission: ENotificationPermission;
    }
  | undefined = {
  isSupported: true,
  permission: ENotificationPermission.granted,
};
let mockIsLoading: boolean | undefined = false;

const mockPlatformEnv = {
  isDesktop: false,
  isWebDappMode: false,
};

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
      onPress,
      testID,
    }: {
      children?: import('react').ReactNode;
      onPress?: () => void;
      testID?: string;
    }) =>
      React.createElement(
        'button',
        { type: 'button', onClick: onPress, 'data-testid': testID },
        children,
      ),
  };
});

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: mockPermission,
    isLoading: mockIsLoading,
    run: mockReload,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useHandleAppStateActive', () => ({
  useHandleAppStateActive: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isDesktop() {
      return mockPlatformEnv.isDesktop;
    },
    get isWebDappMode() {
      return mockPlatformEnv.isWebDappMode;
    },
  },
}));

jest.mock('@onekeyhq/kit/src/utils/notificationPermissionUtils', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/kit/src/utils/notificationPermissionUtils')
  >('@onekeyhq/kit/src/utils/notificationPermissionUtils');
  return {
    ...actual,
    recoverOsNotificationPermission: (...args: unknown[]) => {
      const result: Promise<unknown> = mockRecover(...args);
      return result;
    },
    canSendOsNotificationTest: (...args: unknown[]) => {
      const result: Promise<boolean> = mockCanSend(...args);
      return result;
    },
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNotification: {
      showNotification: (...args: unknown[]) => {
        const result: Promise<unknown> = mockShowNotification(...args);
        return result;
      },
    },
  },
}));

describe('NotificationsTestButton', () => {
  beforeEach(() => {
    mockShowNotification.mockReset();
    mockRecover.mockReset();
    mockCanSend.mockReset();
    mockReload.mockReset();
    mockPlatformEnv.isDesktop = false;
    mockPlatformEnv.isWebDappMode = false;
    mockPermission = {
      isSupported: true,
      permission: ENotificationPermission.granted,
    };
    mockIsLoading = false;
  });

  it('does not flash Test while the OS permission is still loading', () => {
    mockPermission = undefined;
    mockIsLoading = undefined;
    const { queryByText, getByTestId } = render(<NotificationsTestButton />);

    expect(queryByText(ETranslations.global_test)).toBeNull();
    expect(queryByText(ETranslations.global_enable)).toBeNull();
    expect(queryByText(ETranslations.global_go_to_settings)).toBeNull();
    fireEvent.click(getByTestId('setting-notification-permission-btn'));
    expect(mockCanSend).not.toHaveBeenCalled();
    expect(mockRecover).not.toHaveBeenCalled();
  });

  it('falls back to Test after the permission read finishes without a payload', () => {
    mockPermission = undefined;
    mockIsLoading = false;
    const { getByTestId } = render(<NotificationsTestButton />);

    expect(getByTestId('setting-intl-btn').textContent).toBe(
      ETranslations.global_test,
    );
  });

  it('shows only Test when the OS permission is already granted', () => {
    const { queryByTestId, getByTestId } = render(<NotificationsTestButton />);

    expect(queryByTestId('setting-notification-permission-btn')).toBeNull();
    expect(getByTestId('setting-intl-btn').textContent).toBe(
      ETranslations.global_test,
    );
  });

  it('shows only Enable while authorization is still undetermined', () => {
    mockPermission = {
      isSupported: true,
      permission: ENotificationPermission.default,
    };
    const { getByTestId, queryByTestId } = render(<NotificationsTestButton />);

    expect(getByTestId('setting-notification-permission-btn').textContent).toBe(
      ETranslations.global_enable,
    );
    expect(queryByTestId('setting-intl-btn')).toBeNull();
  });

  it('shows Go to Settings after the system prompt has already been denied', () => {
    mockPermission = {
      isSupported: true,
      permission: ENotificationPermission.denied,
    };
    const { getByTestId, queryByTestId } = render(<NotificationsTestButton />);

    expect(getByTestId('setting-notification-permission-btn').textContent).toBe(
      ETranslations.global_go_to_settings,
    );
    expect(queryByTestId('setting-intl-btn')).toBeNull();
  });

  it('sends the preview automatically after Enable is granted', async () => {
    mockPermission = {
      isSupported: true,
      permission: ENotificationPermission.default,
    };
    mockRecover.mockResolvedValue({
      isSupported: true,
      permission: ENotificationPermission.granted,
    });
    mockShowNotification.mockResolvedValue({ notificationId: '1' });
    const { getByTestId } = render(<NotificationsTestButton />);

    fireEvent.click(getByTestId('setting-notification-permission-btn'));

    await waitFor(() => {
      expect(mockRecover).toHaveBeenCalledTimes(1);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });
  });

  it('does not send a preview if Enable is denied', async () => {
    mockPermission = {
      isSupported: true,
      permission: ENotificationPermission.default,
    };
    mockRecover.mockResolvedValue({
      isSupported: true,
      permission: ENotificationPermission.denied,
    });
    const { getByTestId } = render(<NotificationsTestButton />);

    fireEvent.click(getByTestId('setting-notification-permission-btn'));

    await waitFor(() => {
      expect(mockRecover).toHaveBeenCalledTimes(1);
    });
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('opens Settings from the denied CTA without sending a preview', async () => {
    mockPermission = {
      isSupported: true,
      permission: ENotificationPermission.denied,
    };
    mockRecover.mockResolvedValue({
      isSupported: true,
      permission: ENotificationPermission.denied,
    });
    const { getByTestId } = render(<NotificationsTestButton />);

    fireEvent.click(getByTestId('setting-notification-permission-btn'));

    await waitFor(() => {
      expect(mockRecover).toHaveBeenCalledTimes(1);
    });
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('sends the test notification from Test after permission is confirmed', async () => {
    mockCanSend.mockResolvedValue(true);
    mockShowNotification.mockResolvedValue({ notificationId: '1' });
    const { getByTestId } = render(<NotificationsTestButton />);

    fireEvent.click(getByTestId('setting-intl-btn'));

    await waitFor(() => {
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });
  });
});
