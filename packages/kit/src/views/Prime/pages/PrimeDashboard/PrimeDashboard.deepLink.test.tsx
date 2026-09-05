/** @jest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { PrimeLoginDialogCancelError } from '@onekeyhq/shared/src/errors';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

import PrimeDashboard from './PrimeDashboard';

const mockLogin = jest.fn<Promise<void>, []>();
const mockEnsureSubscription = jest.fn(async () => undefined);
const mockNavigation = { push: jest.fn(), setParams: jest.fn() };
const mockAuth = {
  isReady: true,
  isLoggedIn: false,
  isPrimeSubscriptionActive: false,
  user: {},
  loginOneKeyId: mockLogin,
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@react-navigation/core', () => ({ useIsFocused: () => false }));
jest.mock('react-native', () => ({ StyleSheet: { hairlineWidth: 1 } }));
jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: ReactNode }) =>
    children ?? null;
  return {
    Page: Object.assign(Container, {
      Header: () => null,
      Body: Container,
      Footer: Container,
      FooterActions: ({ onConfirm }: { onConfirm: () => void }) => (
        <button type="button" onClick={onConfirm}>
          Subscribe
        </button>
      ),
    }),
    Icon: () => null,
    LinearGradient: () => null,
    NavCloseButton: () => null,
    SizableText: Container,
    Spinner: () => null,
    Stack: Container,
    Theme: Container,
    XStack: Container,
    YStack: Container,
    useIsModalPage: () => false,
    useSafeAreaInsets: () => ({ top: 0 }),
    useTheme: () => ({ bgApp: { val: '#000000' } }),
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { servicePrime: { isLoggedIn: async () => false } },
}));
jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => mockAuth,
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: {} }),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        primeDashboardShow: jest.fn(),
        primeSubscribeButtonClick: jest.fn(),
      },
    },
  },
}));
jest.mock('../../hooks/usePrimeRequirements', () => ({
  usePrimeRequirements: () => ({
    ensurePrimeSubscriptionActive: mockEnsureSubscription,
  }),
}));
jest.mock('../../hooks/usePrimeSubscriptionPackages', () => ({
  usePrimeSubscriptionPackages: () => ({
    packages: [{ subscriptionPeriod: 'P1Y' }],
    isPurchaseReady: true,
  }),
}));
jest.mock(
  '../../components/PrimePurchaseDialog/PrimeSubscriptionPlans',
  () => ({
    PrimeSubscriptionPlans: () => null,
  }),
);
jest.mock('./PrimeBenefitsList', () => ({ PrimeBenefitsList: () => null }));
jest.mock('./PrimeDebugPanel', () => ({ PrimeDebugPanel: () => null }));
jest.mock('./PrimeLottieAnimation', () => ({
  PrimeLottieAnimation: () => null,
}));
jest.mock('./PrimeTermsAndPrivacy', () => ({
  PrimeTermsAndPrivacy: () => null,
}));
jest.mock('./PrimeUserInfo', () => ({ PrimeUserInfo: () => null }));
jest.mock('./primeSubscribeLoadingUtils', () => ({
  runPrimeSubscribeWithMinimumLoadingDuration: (run: () => Promise<void>) =>
    run(),
}));

describe('PrimeDashboard subscription deep link', () => {
  let completeLogin: () => void;
  let cancelLogin: (error: Error) => void;
  let route: ComponentProps<typeof PrimeDashboard>['route'];

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockAuth.isReady = true;
    mockAuth.isLoggedIn = false;
    mockLogin.mockImplementation(
      () =>
        new Promise<void>((resolve, reject) => {
          completeLogin = resolve;
          cancelLogin = reject;
        }),
    );
    route = {
      key: 'dashboard',
      name: EPrimePages.PrimeDashboard,
      params: { fromDeepLink: true },
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([false, true])(
    'awaits login completion even when persisted login is %s',
    async (persistedLogin) => {
      mockAuth.isLoggedIn = persistedLogin;
      const { rerender } = render(<PrimeDashboard route={route} />);
      expect(mockLogin).toHaveBeenCalledTimes(1);

      // Publishing login flags precedes the dialog-close completion promise.
      mockAuth.isLoggedIn = true;
      rerender(<PrimeDashboard route={route} />);
      expect(mockNavigation.push).not.toHaveBeenCalled();
      await act(async () => {
        completeLogin();
      });

      expect(mockNavigation.setParams).toHaveBeenCalledWith({
        fromDeepLink: undefined,
      });
      expect(mockNavigation.push).toHaveBeenCalledTimes(1);
      expect(mockNavigation.push).toHaveBeenCalledWith(
        EPrimePages.PrimeInfiniSubscription,
      );
      route = { ...route, params: {} };
      rerender(<PrimeDashboard route={route} />);
      expect(mockNavigation.push).toHaveBeenCalledTimes(1);
    },
  );

  it('waits for auth initialization before starting login', () => {
    mockAuth.isReady = false;
    const { rerender } = render(<PrimeDashboard route={route} />);
    expect(mockLogin).not.toHaveBeenCalled();
    mockAuth.isReady = true;
    rerender(<PrimeDashboard route={route} />);
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it('lets an explicit checkout replace the management handoff', async () => {
    const { rerender } = render(<PrimeDashboard route={route} />);
    await act(async () => {
      fireEvent.click(screen.getAllByText('Subscribe')[0]);
    });
    expect(mockNavigation.setParams).toHaveBeenCalledWith({
      fromDeepLink: undefined,
    });
    expect(mockEnsureSubscription).toHaveBeenCalledTimes(1);

    route = { ...route, params: {} };
    mockAuth.isLoggedIn = true;
    rerender(<PrimeDashboard route={route} />);
    await act(async () => {
      completeLogin();
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(mockEnsureSubscription).toHaveBeenCalledTimes(2);
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('ends the handoff when login is cancelled', async () => {
    render(<PrimeDashboard route={route} />);
    await act(async () => {
      cancelLogin(new PrimeLoginDialogCancelError());
    });
    expect(mockNavigation.setParams).toHaveBeenCalledWith({
      fromDeepLink: undefined,
    });
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('does not navigate after the dashboard unmounts', async () => {
    const { unmount } = render(<PrimeDashboard route={route} />);
    unmount();
    await act(async () => {
      completeLogin();
    });
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });
});
