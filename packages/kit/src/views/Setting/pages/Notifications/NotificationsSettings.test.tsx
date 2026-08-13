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
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import type { INotificationPushSettings } from '@onekeyhq/shared/types/notification';

import NotificationsSettings from './NotificationsSettings';

const mockInitialSettings: INotificationPushSettings = {
  pushEnabled: true,
  accountActivityPushEnabled: false,
  priceAlertsEnabled: false,
  perpsEnabled: false,
  announcementEnabled: false,
  dailyUpdateEnabled: false,
};
const mockFetchServerNotificationSettings = jest.fn<
  Promise<INotificationPushSettings>,
  unknown[]
>();
const mockUpdateServerNotificationSettings = jest.fn<
  Promise<INotificationPushSettings>,
  [INotificationPushSettings]
>();
const mockNavigationPush = jest.fn();
const mockNavigationPushModal = jest.fn();
const mockNotificationsTestButtonProps = jest.fn();
const mockDebouncedSchedule = jest.fn();
let mockIsExtension = false;
let mockIsNativeIOS = false;
let mockFlushDebounced: (() => void) | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('use-debounce', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useDebouncedCallback: (callback: () => void) => {
      const callbackRef = React.useRef(callback);
      callbackRef.current = callback;
      return React.useMemo(() => {
        const debounced = () => {
          mockDebouncedSchedule();
        };
        debounced.flush = () => {
          callbackRef.current();
        };
        mockFlushDebounced = debounced.flush;
        return debounced;
      }, []);
    },
  };
});

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  const Page = Container as typeof Container & {
    Header: typeof Container;
    Body: typeof Container;
  };
  Page.Header = ({
    children,
    ...props
  }: {
    children?: ReactNode;
    title?: string;
  }) => React.createElement('header', null, props.title, children);
  Page.Body = Container;

  return {
    Button: ({
      children,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      testID?: string;
    }) =>
      React.createElement(
        'button',
        { 'data-testid': testID, onClick: onPress },
        children,
      ),
    Divider: () => React.createElement('hr'),
    Page,
    SizableText: Container,
    Spinner: () => React.createElement('span', null, 'loading'),
    Stack: Container,
    Switch: ({
      onChange,
      testID,
      value,
    }: {
      onChange?: (value: boolean) => void;
      testID?: string;
      value?: boolean;
    }) =>
      React.createElement('button', {
        'aria-pressed': value,
        'data-testid': testID,
        onClick: () => onChange?.(!value),
      }),
  };
});

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const ListItem = ({
    children,
    onPress,
    subtitle,
    testID,
    title,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    subtitle?: ReactNode;
    testID?: string;
    title?: ReactNode;
  }) =>
    React.createElement(
      'div',
      { 'data-list-item': true, 'data-testid': testID, onClick: onPress },
      title,
      subtitle,
      children,
    );
  ListItem.Text = ({
    primary,
    secondary,
  }: {
    primary?: ReactNode;
    secondary?: ReactNode;
  }) => React.createElement('div', null, primary, secondary);
  return { ListItem };
});

jest.mock('@onekeyhq/kit/src/components/MultipleClickStack', () => ({
  MultipleClickStack: () => null,
}));

jest.mock('@onekeyhq/kit/src/components/PermissionsDialog', () => ({
  showNotificationPermissionsDialog: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    push: mockNavigationPush,
    pushModal: mockNavigationPushModal,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: undefined }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: false }],
  useNotificationsAtom: () => [{}, jest.fn()],
  useSettingsPersistAtom: () => [{ instanceId: 'instance-id' }],
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isExtension() {
      return mockIsExtension;
    },
    get isNativeIOS() {
      return mockIsNativeIOS;
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: () => Promise.resolve() },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNotification: {
      fetchServerNotificationSettings: (...args: unknown[]) =>
        mockFetchServerNotificationSettings(...args),
      getPermission: () =>
        Promise.resolve({ isSupported: false, permission: 'default' }),
      updateServerNotificationSettings: (settings: INotificationPushSettings) =>
        mockUpdateServerNotificationSettings(settings),
    },
  },
}));

jest.mock('../../components/NotificationsHelpCenterInstruction', () => ({
  __esModule: true,
  default: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return React.createElement('span', {
      'data-testid': 'notification-help-center-instruction',
    });
  },
}));

jest.mock('../../components/NotificationsTestButton', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: (props: {
      labelId?: ETranslations;
      showPermissionAction?: boolean;
    }) => {
      mockNotificationsTestButtonProps(props);
      return React.createElement(
        'button',
        null,
        props.labelId ?? ETranslations.global_test,
      );
    },
  };
});

async function renderSettings() {
  const view = render(<NotificationsSettings />);
  await waitFor(() => {
    expect(screen.getByTestId('notification-setting-pushEnabled')).toBeTruthy();
  });
  return view;
}

describe('NotificationsSettings', () => {
  beforeEach(() => {
    mockIsExtension = false;
    mockIsNativeIOS = false;
    mockFetchServerNotificationSettings.mockReset();
    mockUpdateServerNotificationSettings.mockReset();
    mockNavigationPush.mockReset();
    mockNavigationPushModal.mockReset();
    mockNotificationsTestButtonProps.mockReset();
    mockDebouncedSchedule.mockReset();
    mockFlushDebounced = undefined;
    mockFetchServerNotificationSettings.mockResolvedValue({
      ...mockInitialSettings,
    });
    mockUpdateServerNotificationSettings.mockImplementation(
      async (settings) => settings,
    );
  });

  it('renders the requested information architecture and preserves all six field mappings', async () => {
    const { container } = await renderSettings();
    const labelsInOrder = [
      ETranslations.notifications_settings_helper_title,
      ETranslations.notifications_notifications_account_activity_label,
      ETranslations.wallet_activity__title,
      ETranslations.notification_accounts__action,
      ETranslations.perps_alerts__title,
      ETranslations.alerts_and_updates__action,
      ETranslations.global_price_alerts,
      ETranslations.important_notices__title,
      ETranslations.product_and_market_updates__title,
    ];
    const renderedText = container.textContent ?? '';
    const labelPositions = labelsInOrder.map((label) =>
      renderedText.indexOf(label),
    );
    expect(labelPositions.every((position) => position >= 0)).toBe(true);
    expect(labelPositions).toEqual(
      [...labelPositions].toSorted((a, b) => a - b),
    );
    expect(
      screen.getByText(ETranslations.notifications_settings_helper_desc),
    ).toBeTruthy();
    expect(
      screen.getByTestId('notification-help-center-instruction'),
    ).toBeTruthy();
    expect(screen.getByText(ETranslations.global_test)).toBeTruthy();
    expect(screen.queryByText(ETranslations.on_this_device__title)).toBeNull();
    expect(screen.queryByTestId('notification-preview-row')).toBeNull();
    expect(screen.queryByTestId('notification-help-center-row')).toBeNull();

    [
      'accountActivityPushEnabled',
      'priceAlertsEnabled',
      'perpsEnabled',
      'announcementEnabled',
      'dailyUpdateEnabled',
    ].forEach((field) => {
      fireEvent.click(screen.getByTestId(`notification-setting-${field}`));
    });
    fireEvent.click(screen.getByTestId('notification-setting-pushEnabled'));

    act(() => {
      mockFlushDebounced?.();
    });
    await waitFor(() => {
      expect(mockUpdateServerNotificationSettings).toHaveBeenCalledWith({
        pushEnabled: false,
        accountActivityPushEnabled: true,
        priceAlertsEnabled: true,
        perpsEnabled: true,
        announcementEnabled: true,
        dailyUpdateEnabled: true,
      });
    });
  });

  it('keeps account management as an independent drill-in row', async () => {
    await renderSettings();

    fireEvent.click(screen.getByTestId('notification-accounts-row'));
    expect(mockNavigationPush).toHaveBeenCalledWith(
      EModalSettingRoutes.SettingManageAccountActivity,
    );
  });

  it('hides only Price alerts on Extension and enables iOS test recovery', async () => {
    mockIsExtension = true;
    mockIsNativeIOS = true;
    await renderSettings();

    expect(
      screen.queryByTestId('notification-setting-priceAlertsEnabled'),
    ).toBeNull();
    expect(
      screen.getByTestId('notification-setting-announcementEnabled'),
    ).toBeTruthy();
    expect(mockNotificationsTestButtonProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        showPermissionAction: true,
      }),
    );
    expect(
      mockNotificationsTestButtonProps.mock.calls.at(-1)?.[0],
    ).not.toHaveProperty('labelId');
  });
});
