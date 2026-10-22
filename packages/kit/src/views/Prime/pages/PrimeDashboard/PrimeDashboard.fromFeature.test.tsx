/** @jest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';

import PrimeDashboard from './PrimeDashboard';

const mockLogin = jest.fn<Promise<void>, []>();
const mockEnsureSubscription = jest.fn(async () => undefined);
const mockRequirements = {
  ensurePrimeSubscriptionActive: mockEnsureSubscription,
};
const mockShowOneKeyIdLoginFailedToast = jest.fn();
const mockToastMessage = jest.fn();
const mockNavigation = {
  popStack: jest.fn(),
  push: jest.fn(),
  setParams: jest.fn(),
};
const mockAuth = {
  isReady: true,
  isLoggedIn: false,
  isPrimeSubscriptionActive: false,
  user: {},
  loginOneKeyId: mockLogin,
};
const mockIntl = {
  formatMessage: ({ id }: { id: string }) => id,
};

jest.mock('react-intl', () => ({
  useIntl: () => mockIntl,
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
    SizableText: ({
      children,
      onPress,
    }: {
      children?: ReactNode;
      onPress?: () => void;
    }) =>
      onPress ? (
        <button type="button" onClick={onPress}>
          {children}
        </button>
      ) : (
        (children ?? null)
      ),
    Spinner: () => null,
    Stack: Container,
    Theme: Container,
    Toast: {
      message: (...args: unknown[]) => {
        mockToastMessage(...args);
      },
    },
    XStack: Container,
    YStack: Container,
    useIsModalPage: () => false,
    useSafeAreaInsets: () => ({ top: 0 }),
    useTheme: () => ({ bgApp: { val: '#000000' } }),
  };
});
const mockFetchPrimeUserInfo = jest.fn<Promise<unknown>, unknown[]>();
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      isLoggedIn: async () => false,
      apiFetchPrimeUserInfo: (...args: unknown[]) =>
        mockFetchPrimeUserInfo(...args),
    },
  },
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
jest.mock('../../components/oneKeyIdLoginToastUtils', () => ({
  showOneKeyIdLoginFailedToast: (...args: unknown[]) => {
    mockShowOneKeyIdLoginFailedToast(...args);
  },
}));
jest.mock('../../hooks/usePrimeRequirements', () => ({
  usePrimeRequirements: () => ({
    ensurePrimeSubscriptionActive:
      mockRequirements.ensurePrimeSubscriptionActive,
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

const LOGIN_PROMPT = 'prime.already_subscribed_log_in';
const ALREADY_ACTIVE = 'prime_already_active__msg';

function clickSubscribe() {
  fireEvent.click(screen.getAllByText('Subscribe')[0]);
}

function clickLogin() {
  fireEvent.click(screen.getAllByRole('button', { name: LOGIN_PROMPT })[0]);
}

function mockPrimeStatus(isActive: boolean) {
  mockFetchPrimeUserInfo.mockResolvedValue({
    userInfo: { isLoggedIn: true },
    primeSubscription: { isActive },
  });
}

describe('PrimeDashboard opened from a gated feature', () => {
  let completeLogin: () => void;
  let route: ComponentProps<typeof PrimeDashboard>['route'];

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockAuth.isReady = true;
    mockAuth.isLoggedIn = false;
    mockAuth.isPrimeSubscriptionActive = false;
    mockRequirements.ensurePrimeSubscriptionActive = mockEnsureSubscription;
    mockLogin.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          completeLogin = resolve;
        }),
    );
    route = {
      key: 'dashboard',
      name: EPrimePages.PrimeDashboard,
      params: { fromFeature: EPrimeFeatures.BulkSend },
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('closes with a toast when an existing member logs in', async () => {
    mockPrimeStatus(true);
    render(<PrimeDashboard route={route} />);
    await act(async () => {
      clickLogin();
    });
    await act(async () => {
      completeLogin();
    });

    expect(mockFetchPrimeUserInfo).toHaveBeenCalledWith({
      forceRefresh: true,
    });
    expect(mockToastMessage).toHaveBeenCalledWith({ title: ALREADY_ACTIVE });
    expect(mockNavigation.popStack).toHaveBeenCalledTimes(1);
  });

  it('stays when the logged-in user has no Prime', async () => {
    mockPrimeStatus(false);
    render(<PrimeDashboard route={route} />);
    await act(async () => {
      clickLogin();
    });
    await act(async () => {
      completeLogin();
    });

    expect(mockFetchPrimeUserInfo).toHaveBeenCalledTimes(1);
    expect(mockToastMessage).not.toHaveBeenCalled();
    expect(mockNavigation.popStack).not.toHaveBeenCalled();
  });

  it('stays when the Prime status cannot be fetched', async () => {
    mockFetchPrimeUserInfo.mockRejectedValue(new Error('network'));
    render(<PrimeDashboard route={route} />);
    await act(async () => {
      clickLogin();
    });
    await act(async () => {
      completeLogin();
    });

    expect(mockToastMessage).not.toHaveBeenCalled();
    expect(mockNavigation.popStack).not.toHaveBeenCalled();
  });

  it('closes instead of resuming checkout when Subscribe logged in a member', async () => {
    mockPrimeStatus(true);
    const { rerender } = render(<PrimeDashboard route={route} />);
    await act(async () => {
      clickSubscribe();
    });
    expect(mockEnsureSubscription).toHaveBeenCalledTimes(1);

    mockAuth.isLoggedIn = true;
    rerender(<PrimeDashboard route={route} />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });

    expect(mockEnsureSubscription).toHaveBeenCalledTimes(1);
    expect(mockToastMessage).toHaveBeenCalledWith({ title: ALREADY_ACTIVE });
    expect(mockNavigation.popStack).toHaveBeenCalledTimes(1);
  });

  it('resumes checkout when Subscribe logged in a non-member', async () => {
    mockPrimeStatus(false);
    const { rerender } = render(<PrimeDashboard route={route} />);
    await act(async () => {
      clickSubscribe();
    });

    mockAuth.isLoggedIn = true;
    rerender(<PrimeDashboard route={route} />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });

    expect(mockEnsureSubscription).toHaveBeenCalledTimes(2);
    expect(mockNavigation.popStack).not.toHaveBeenCalled();
  });

  it('keeps the dashboard open when not opened from a feature', async () => {
    mockPrimeStatus(true);
    route = { ...route, params: {} };
    render(<PrimeDashboard route={route} />);
    await act(async () => {
      clickLogin();
    });
    await act(async () => {
      completeLogin();
    });

    expect(mockFetchPrimeUserInfo).not.toHaveBeenCalled();
    expect(mockNavigation.popStack).not.toHaveBeenCalled();
  });
});
