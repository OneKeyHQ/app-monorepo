/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';
import { loadLocaleMessages } from '@onekeyhq/shared/src/locale/localeLoaders';

import { PrimeFeatureIntroContent } from './PrimeFeatureIntroContent';

import type { IPrimePackagesFetchFailure } from '../../hooks/primePackagesFetchFailure';
import type { IPackage } from '../../hooks/usePrimePaymentTypes';

const mockSubscribe = jest.fn<Promise<void>, [unknown]>();
const mockReloadPackages = jest.fn<Promise<void>, []>();
let mockCanPurchaseWithoutPackages = false;
let mockCtaKind = 'subscribe';
let mockGtMd = false;
let mockPackages: IPackage[] = [];
let mockFailure: IPrimePackagesFetchFailure | undefined;
let messages: Awaited<ReturnType<typeof loadLocaleMessages>>;

jest.mock('react-native', () => ({
  Animated: {},
  Image: {},
  PanResponder: { create: () => ({ panHandlers: {} }) },
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', undefined, children);
  const Button = ({
    children,
    testID,
    disabled,
    onPress,
  }: {
    children?: ReactNode;
    testID?: string;
    disabled?: boolean;
    onPress?: () => void;
  }) =>
    React.createElement(
      'button',
      { 'data-testid': testID, disabled, onClick: onPress },
      children,
    );
  const Footer = ({
    children,
    extraContent,
    onConfirmText,
    onConfirm,
    confirmButtonProps,
  }: {
    children?: ReactNode;
    extraContent?: ReactNode;
    onConfirmText?: string;
    onConfirm?: (options: { preventClose: () => void }) => void;
    confirmButtonProps?: { disabled?: boolean; testID?: string };
  }) =>
    React.createElement(
      'div',
      undefined,
      children,
      extraContent,
      React.createElement(
        Button,
        {
          ...confirmButtonProps,
          onPress: () => onConfirm?.({ preventClose: () => undefined }),
        },
        onConfirmText,
      ),
    );
  return {
    Badge: Object.assign(Container, { Text: Container }),
    Button,
    Dialog: { Footer },
    Page: { Footer: Container, FooterActions: Footer },
    Icon: () => null,
    IconButton: () => null,
    LinearGradient: Container,
    SizableText: Container,
    Stack: Container,
    Swiper: () => null,
    Theme: Container,
    Video: () => null,
    XStack: Container,
    YStack: Container,
    fs: (value: number) => value,
    getTokenValue: () => 1,
    useMedia: () => ({ gtMd: mockGtMd }),
  };
});
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    isReady: true,
    isLoggedIn: true,
    isPrimeSubscriptionActive: false,
    isPrimeActive: false,
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: {} }),
}));
jest.mock('../../../BulkSend/hooks/useBulkSendModeDialog', () => ({
  useBulkSendModeDialog: () => jest.fn(),
}));
jest.mock('../../../BulkSend/hooks/useNavigateToBulkSend', () => ({
  useNavigateToBulkSend: () => jest.fn(),
}));
jest.mock('../../../Home/hooks/useNavigateToApprovalList', () => ({
  useNavigateToApprovalList: () => jest.fn(),
}));
jest.mock('../../hooks/usePrimeRequirements', () => ({
  usePrimeRequirements: () => ({
    ensurePrimeSubscriptionActive: mockSubscribe,
  }),
}));
jest.mock('../../hooks/usePrimeSubscriptionPackages', () => ({
  usePrimeSubscriptionPackages: () => ({
    packages: mockPackages,
    isPackagesLoading: false,
    packagesFailure: mockFailure,
    reloadPackages: mockReloadPackages,
  }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/prime/primePaymentCapabilities', () => ({
  isPrimeAppleStorePayment: () => !mockCanPurchaseWithoutPackages,
  isPrimeCryptoPaymentSupported: () => mockCanPurchaseWithoutPackages,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        primeUpsellShow: jest.fn(),
        primeUpsellActionClick: jest.fn(),
        primeSubscribeButtonClick: jest.fn(),
        primePackagesFailStateShow: jest.fn(),
        primePackagesFailStateAction: jest.fn(),
      },
    },
  },
}));
jest.mock('./primeFeatureIntroUtils', () => ({
  PRIME_FEATURE_INTROS: [
    {
      id: 'test-feature',
      title: 'prime_app_only__title',
      description: 'prime_plans_network_error__desc',
    },
  ],
  getPrimeFeatureIntroCtaKind: () => mockCtaKind,
}));

function renderIntro(mode: 'content' | 'page' | 'dialog' = 'content') {
  return render(
    <IntlProvider locale="en" messages={messages}>
      <PrimeFeatureIntroContent mode={mode} />
    </IntlProvider>,
  );
}

describe('Prime feature introduction plan failures', () => {
  beforeEach(async () => {
    messages = await loadLocaleMessages('en');
    jest.clearAllMocks();
    mockCanPurchaseWithoutPackages = false;
    mockCtaKind = 'subscribe';
    mockGtMd = false;
    mockPackages = [];
    mockFailure = { kind: 'network' };
    mockReloadPackages.mockResolvedValue(undefined);
    mockSubscribe.mockResolvedValue(undefined);
  });

  it.each(['content', 'page', 'dialog'] as const)(
    'shows Retry and blocks store checkout in %s mode',
    async (mode) => {
      renderIntro(mode);
      expect(
        screen.getByText(
          enMessages[ETranslations.prime_plans_unavailable__title],
        ),
      ).toBeTruthy();
      expect(
        (screen.getByTestId('prime-feature-intro-cta') as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      fireEvent.click(screen.getByTestId('prime-feature-intro-cta'));
      expect(mockSubscribe).not.toHaveBeenCalled();
      await act(async () => {
        fireEvent.click(screen.getByTestId('prime-packages-fetch-retry'));
      });
      expect(mockReloadPackages).toHaveBeenCalledTimes(1);
    },
  );

  it('shows the failure and Retry in a wide dialog', () => {
    mockGtMd = true;
    renderIntro('dialog');
    expect(screen.getByTestId('prime-packages-fetch-retry')).toBeTruthy();
  });

  it('allows supported card/crypto checkout after plan loading fails', async () => {
    mockCanPurchaseWithoutPackages = true;
    renderIntro();
    expect(
      (screen.getByTestId('prime-feature-intro-cta') as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    await act(async () => {
      fireEvent.click(screen.getByTestId('prime-feature-intro-cta'));
    });
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it('enables store checkout when retry restores a matching plan', async () => {
    const view = renderIntro();
    await act(async () => {
      fireEvent.click(screen.getByTestId('prime-packages-fetch-retry'));
    });
    mockFailure = undefined;
    mockPackages = [
      { subscriptionPeriod: 'P1Y', pricePerYearString: '$20' } as IPackage,
    ];
    view.rerender(
      <IntlProvider locale="en" messages={messages}>
        <PrimeFeatureIntroContent />
      </IntlProvider>,
    );
    expect(screen.queryByTestId('prime-packages-fetch-retry')).toBeNull();
    expect(
      (screen.getByTestId('prime-feature-intro-cta') as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    await act(async () => {
      fireEvent.click(screen.getByTestId('prime-feature-intro-cta'));
    });
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not show subscription loading errors for an active feature action', () => {
    mockCtaKind = 'featureAction';
    renderIntro();
    expect(screen.queryByTestId('prime-packages-fetch-retry')).toBeNull();
    expect(
      (screen.getByTestId('prime-feature-intro-cta') as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});
