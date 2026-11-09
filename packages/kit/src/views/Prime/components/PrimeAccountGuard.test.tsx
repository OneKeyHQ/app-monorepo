/** @jest-environment jsdom */

import type { ComponentType, ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EPrimeGiftPages,
  EPrimePages,
} from '@onekeyhq/shared/src/routes/prime';

import OneKeyId from '../pages/OneKeyId';
import { PrimeGiftRouter, PrimeRouter } from '../router';
import { PrimeTestIDs } from '../testIDs';

import { PrimeAccountGuard } from './PrimeAccountGuard';

let mockIsBanned = true;
let mockIsBannedMockEnabled = false;
const mockUpdateDevSetting = jest.fn(
  async (_name: string, _value: boolean) => undefined,
);
const mockPushModal = jest.fn();
const mockPush = jest.fn();
const mockRefer = jest.fn();
let mockGtMd = true;
const mockLogout = jest.fn();
const mockProtectedMount = jest.fn();
let mockHeaderOptions = { headerShown: false };
const mockHeaderNavigation = {
  setOptions: jest.fn((options: Partial<typeof mockHeaderOptions>) => {
    mockHeaderOptions = { ...mockHeaderOptions, ...options };
  }),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockHeaderNavigation,
}));
jest.mock('react-native', () => ({
  StyleSheet: { hairlineWidth: 1 },
}));
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  useOverlayPageScope: () => ({}),
}));
jest.mock('../../../../../components/src/hocs', () => ({
  useIsOverlayPage: () => true,
}));
jest.mock('../../../../../components/src/hooks', () => ({
  useTheme: () => ({ text: { val: '#000' } }),
}));
jest.mock(
  '../../../../../components/src/primitives/Button/GlassHeaderContext',
  () => ({
    toNoGlassHeaderItems: () => undefined,
    wrapHeaderRenderInGlass: (renderHeader: unknown) => renderHeader,
  }),
);
jest.mock(
  '../../../../../components/src/layouts/Navigation/Header/HeaderSearchBar',
  () => () => null,
);
jest.mock('../../../components/LazyLoadPage', () => ({
  LazyLoadPage: (factory: () => Promise<{ default: ComponentType }>) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const Component = React.lazy(factory);
    return function LazyPage() {
      return (
        <React.Suspense fallback={null}>
          <Component />
        </React.Suspense>
      );
    };
  },
}));
jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    isLoggedIn: true,
    user: {
      isOneKeyIdBanned: mockIsBanned,
      displayEmail: 'test@example.com',
      nickname: 'Test account',
    },
  }),
}));
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children: ReactNode }) =>
    children,
}));
jest.mock('@onekeyhq/kit/src/components/OneKeyIdAvatar', () => ({
  OneKeyIdAvatar: () => <span data-testid="account-avatar" />,
}));
jest.mock('@onekeyhq/kit/src/hooks/useReferFriends', () => ({
  useReferFriends: () => ({ toInviteRewardPage: mockRefer }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));
jest.mock('./OneKeyIdLegacyOAuthBind/OneKeyIdLegacyOAuthBind', () => ({
  OneKeyIdLegacyOAuthBindPrompt: () => <div data-testid="oauth-bind-prompt" />,
}));
jest.mock('./PrimeUserBadge', () => ({
  PrimeUserBadge: ({ disabled }: { disabled: boolean }) => (
    <span data-testid="prime-status-badge" aria-disabled={disabled} />
  ),
}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({
    title,
    disabled,
    onPress,
    testID,
  }: {
    title: string;
    disabled?: boolean;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button data-testid={testID} disabled={disabled} onClick={onPress}>
      {title}
    </button>
  ),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimePersistAtom: () => [{ isOneKeyIdBanned: mockIsBanned }],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({
  useDevSettingsPersistAtom: () => [
    {
      enabled: true,
      settings: { mockPrimeUserBanned: mockIsBannedMockEnabled },
    },
  ],
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDev: true, isDesktop: true },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDevSetting: {
      updateDevSetting: (name: string, value: boolean) =>
        mockUpdateDevSetting(name, value),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal, push: mockPush }),
}));
jest.mock(
  '@onekeyhq/kit/src/components/OneKeyAuth/useConfirmOneKeyIdLogout',
  () => ({
    useConfirmOneKeyIdLogout: () => mockLogout,
  }),
);
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { PageHeader } = jest.requireActual<
    typeof import('../../../../../components/src/layouts/Page/PageHeader')
  >('../../../../../components/src/layouts/Page/PageHeader');
  function Container({
    children,
    testID,
    onPress,
    accessibilityState,
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: () => void;
    accessibilityState?: { disabled?: boolean };
  }) {
    return React.createElement(
      'div',
      {
        'data-testid': testID,
        onClick: onPress,
        'aria-disabled': accessibilityState?.disabled,
      },
      children,
    );
  }
  function Button({
    children,
    disabled,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
    testID?: string;
  }) {
    return (
      <button data-testid={testID} disabled={disabled} onClick={onPress}>
        {children}
      </button>
    );
  }
  function ActionList({
    renderTrigger,
    renderItems,
  }: {
    renderTrigger: ReactNode;
    renderItems: (args: { handleActionListClose: () => void }) => ReactNode;
  }) {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        {React.createElement(
          'div',
          { onClick: () => setOpen(true) },
          renderTrigger,
        )}
        {open
          ? renderItems({ handleActionListClose: () => setOpen(false) })
          : null}
      </>
    );
  }
  ActionList.Item = ({
    label,
    testID,
    ...props
  }: { label: string } & Parameters<typeof Button>[0]) => (
    <Button {...props} testID={testID}>
      {label}
    </Button>
  );
  return {
    ActionList,
    Alert: ({ title, testID }: { title: string; testID: string }) => (
      <div data-testid={testID}>{title}</div>
    ),
    Page: Object.assign(Container, {
      Header: PageHeader,
      Body: Container,
      Footer: Container,
    }),
    ScrollView: Container,
    YStack: Container,
    XStack: Container,
    Stack: Container,
    Divider: () => null,
    SizableText: Container,
    Button,
    IconButton: Button,
    NavCloseButton: ({ onPress }: { onPress: () => void }) => (
      <Button onPress={onPress} testID="nav-header-close" />
    ),
    resetPrimeModal: jest.fn(),
    resetToRoute: jest.fn(),
    rootNavigationRef: { current: { navigate: jest.fn() } },
    useMedia: () => ({ gtMd: mockGtMd }),
    useUpdateEffect: jest.fn(),
  };
});

function ProtectedContent() {
  mockProtectedMount();
  return <div>Account features</div>;
}

describe('PrimeAccountGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsBanned = true;
    mockIsBannedMockEnabled = false;
    mockGtMd = true;
  });

  it('previews the actual guard offline and exits without logging out the real account', async () => {
    mockIsBanned = false;
    mockIsBannedMockEnabled = true;
    const view = render(
      <PrimeAccountGuard>
        <ProtectedContent />
      </PrimeAccountGuard>,
    );
    expect(mockProtectedMount).not.toHaveBeenCalled();
    fireEvent.click(
      await screen.findByTestId(PrimeTestIDs.oneKeyIdDeleteAccountBtn),
    );
    expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeDeleteAccount,
    });
    fireEvent.click(screen.getByText(ETranslations.prime_log_out));
    await waitFor(() =>
      expect(mockUpdateDevSetting).toHaveBeenCalledWith(
        'mockPrimeUserBanned',
        false,
      ),
    );
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockIsBanned).toBe(false);
    mockIsBannedMockEnabled = false;
    view.rerender(
      <PrimeAccountGuard>
        <ProtectedContent />
      </PrimeAccountGuard>,
    );
    expect(screen.getByText('Account features')).toBeTruthy();
  });

  it('replaces restricted features before mounting them and keeps deletion available', async () => {
    render(
      <PrimeAccountGuard>
        <ProtectedContent />
      </PrimeAccountGuard>,
    );
    expect(mockProtectedMount).not.toHaveBeenCalled();
    expect(
      await screen.findByText('error__service_prime_user_banned_error'),
    ).toBeTruthy();
    fireEvent.click(
      await screen.findByTestId(PrimeTestIDs.oneKeyIdDeleteAccountBtn),
    );
    expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeDeleteAccount,
    });
    fireEvent.click(screen.getByText(ETranslations.prime_log_out));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  test.each([
    [EModalRoutes.PrimeModal, EPrimePages.PrimeDashboard],
    [EModalRoutes.PrimeModal, EPrimePages.PrimeFeatures],
    [EModalRoutes.PrimeGiftModal, EPrimeGiftPages.PrimeGift],
  ] as const)(
    'restores navigation and deletion from %s/%s',
    async (modal, screenName) => {
      mockGtMd = false;
      const routes =
        modal === EModalRoutes.PrimeModal ? PrimeRouter : PrimeGiftRouter;
      const route = routes.find(({ name }) => name === screenName);
      if (!route?.options || typeof route.options === 'function') {
        throw new OneKeyLocalError(
          'Expected a route with static header options',
        );
      }
      expect(route.options.headerShown).toBe(false);
      mockHeaderOptions = { headerShown: route.options.headerShown ?? true };
      const Component = route.component;

      render(<Component />);

      await screen.findByTestId(PrimeTestIDs.oneKeyIdPage);
      expect(mockHeaderOptions.headerShown).toBe(true);
      fireEvent.click(
        await screen.findByTestId(PrimeTestIDs.oneKeyIdDeleteAccountBtn),
      );
      expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.PrimeModal, {
        screen: EPrimePages.PrimeDeleteAccount,
      });
      expect(
        PrimeRouter.some(({ name }) => name === EPrimePages.PrimeDeleteAccount),
      ).toBe(true);
    },
  );

  it('renders normal users and responds to an identity change', async () => {
    mockIsBanned = false;
    const view = render(
      <PrimeAccountGuard>
        <ProtectedContent />
      </PrimeAccountGuard>,
    );
    expect(screen.getByText('Account features')).toBeTruthy();
    mockIsBanned = true;
    view.rerender(
      <PrimeAccountGuard>
        <ProtectedContent />
      </PrimeAccountGuard>,
    );
    await screen.findByTestId(PrimeTestIDs.oneKeyIdBannedAlert);
    expect(screen.queryByText('Account features')).toBeNull();
    mockIsBanned = false;
    view.rerender(
      <PrimeAccountGuard>
        <ProtectedContent />
      </PrimeAccountGuard>,
    );
    expect(screen.getByText('Account features')).toBeTruthy();
  });

  test.each([true, false])(
    'keeps the original page and disables all restricted entries (desktop layout: %s)',
    (desktopLayout) => {
      mockGtMd = desktopLayout;
      render(<OneKeyId />);
      expect(screen.getAllByText('Test account').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('account-avatar').length).toBeGreaterThan(0);
      expect(screen.getByText(ETranslations.prime_manage_service)).toBeTruthy();
      for (const testID of [
        PrimeTestIDs.oneKeyIdPrimeBtn,
        PrimeTestIDs.oneKeyIdReferralBtn,
        PrimeTestIDs.oneKeyIdDevicesBtn,
        PrimeTestIDs.oneKeyIdOrdersBtn,
        PrimeTestIDs.oneKeyIdEditProfileBtn,
      ]) {
        for (const entry of screen.getAllByTestId(testID)) {
          expect(entry.hasAttribute('disabled')).toBe(true);
          fireEvent.click(entry);
        }
      }
      fireEvent.click(screen.getByTestId(PrimeTestIDs.oneKeyIdProfileCard));
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockPushModal).not.toHaveBeenCalled();
      expect(mockRefer).not.toHaveBeenCalled();
      expect(screen.queryByTestId('oauth-bind-prompt')).toBeNull();
      expect(
        screen.queryByText(
          'Local mock: no server requests. Log out exits the mock.',
        ),
      ).toBeNull();
      for (const badge of screen.getAllByTestId('prime-status-badge')) {
        expect(badge.getAttribute('aria-disabled')).toBe('true');
      }
      fireEvent.click(
        screen.getByTestId(PrimeTestIDs.oneKeyIdDeleteAccountBtn),
      );
      expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.PrimeModal, {
        screen: EPrimePages.PrimeDeleteAccount,
      });
      fireEvent.click(screen.getByTestId(PrimeTestIDs.oneKeyIdLogoutBtn));
      expect(mockLogout).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps normal account entries enabled and updates them when the account is banned or unbanned', () => {
    mockIsBanned = false;
    const view = render(<OneKeyId />);
    expect(screen.queryByTestId(PrimeTestIDs.oneKeyIdBannedAlert)).toBeNull();
    expect(screen.getByTestId('oauth-bind-prompt')).toBeTruthy();
    fireEvent.click(screen.getByTestId(PrimeTestIDs.oneKeyIdDevicesBtn));
    expect(mockPush).toHaveBeenCalledWith(EPrimePages.PrimeDeviceLimit);
    fireEvent.click(screen.getByTestId(PrimeTestIDs.oneKeyIdReferralBtn));
    expect(mockRefer).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByTestId(PrimeTestIDs.oneKeyIdAccountManagementBtn),
    );
    fireEvent.click(screen.getByTestId(PrimeTestIDs.oneKeyIdDeleteAccountBtn));
    expect(mockPush).toHaveBeenCalledWith(EPrimePages.PrimeDeleteAccount);
    mockIsBanned = true;
    view.rerender(<OneKeyId />);
    expect(
      screen
        .getByTestId(PrimeTestIDs.oneKeyIdDevicesBtn)
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(screen.getByTestId(PrimeTestIDs.oneKeyIdBannedAlert)).toBeTruthy();
    expect(screen.queryByTestId('oauth-bind-prompt')).toBeNull();
    mockIsBanned = false;
    view.rerender(<OneKeyId />);
    expect(
      screen
        .getByTestId(PrimeTestIDs.oneKeyIdDevicesBtn)
        .hasAttribute('disabled'),
    ).toBe(false);
    expect(screen.queryByTestId(PrimeTestIDs.oneKeyIdBannedAlert)).toBeNull();
    expect(screen.getByTestId('oauth-bind-prompt')).toBeTruthy();
  });
});
