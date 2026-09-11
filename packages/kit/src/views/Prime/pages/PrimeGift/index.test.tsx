/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import PrimeGiftPage from '@onekeyhq/kit/src/views/Prime/pages/PrimeGift';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import zhMessages from '@onekeyhq/shared/src/locale/json/zh_CN.json';
import type { ICheckWalletBindStatusResponse } from '@onekeyhq/shared/src/referralCode/type';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import {
  enterWalletAfterOnboarding,
  registerOnboardingCompletion,
} from '../../../Onboardingv2/utils/enterWalletAfterOnboarding';

import type { IShowOnboardingInviteCodeDialog } from '../../../Onboardingv2/components/OnboardingInviteCodeDialog';

const zhTranslations: Record<string, string> = zhMessages;
const mockNavigation = { pop: jest.fn(), switchTabAsync: jest.fn() };
const mockClearTransport = jest.fn();
const mockFlushToast = jest.fn();
let mockSource: 'onboarding' | 'deviceDetails' = 'onboarding';

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const Container = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  return {
    Page: Object.assign(Container, { Header: () => null, Body: Container }),
    NavCloseButton: () => null,
  };
});
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppRoute', () => ({
  useAppRoute: () => ({
    params: {
      source: mockSource,
      onboardingRouteKey: 'completion',
      serialNo: 'SERIAL',
      device: {},
    },
  }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardware: {
      clearForceTransportType: () => {
        mockClearTransport();
      },
    },
  },
}));
jest.mock('@onekeyhq/kit/src/utils/toastExistingWalletSwitch', () => ({
  flushPendingExistingWalletSwitchToast: () => {
    mockFlushToast();
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: false }),
}));
jest.mock('@onekeyhq/kit/src/utils/notificationPermissionUtils', () => ({
  isNotificationFullyEnabled: jest.fn(),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Setting/pages/Protection/usePrimeGiftKyt',
  () => ({ usePrimeGiftKyt: () => ({ isEnabled: false, isLoading: false }) }),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useNotificationsAtom: () => [{}],
}));
jest.mock('../../hooks/usePrimeGiftClaim', () => ({
  usePrimeGiftClaim: () => ({
    result: { onekeyUserId: 'user', addedDays: 180 },
  }),
}));
jest.mock('../../hooks/usePrimeGiftMessages', () => ({
  usePrimeGiftReasonMessage: () => jest.fn(),
}));
jest.mock('../../components/PrimeGiftViews', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    PrimeGiftSuccessView: ({ onEnterWallet }: { onEnterWallet: () => void }) =>
      React.createElement('button', { onClick: onEnterWallet }, 'Enter wallet'),
  };
});

const wallet: IDBWallet = {
  id: 'hw--device-a',
  name: 'OneKey hardware wallet',
  type: 'hw',
  backuped: true,
  accounts: [],
  nextIds: {},
  walletNo: 1,
};
const showInvite = jest.fn<
  ReturnType<IShowOnboardingInviteCodeDialog>,
  Parameters<IShowOnboardingInviteCodeDialog>
>();
const closePage = jest.fn();
const openKeylessDapp = jest.fn<Promise<void>, []>();
const getCreatedWallet = jest.fn<IDBWallet | undefined, []>();
const getReferralCheck = jest.fn<
  Promise<ICheckWalletBindStatusResponse | undefined>,
  []
>();
let unregister: () => void;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockSource = 'onboarding';
  getCreatedWallet.mockReturnValue(wallet);
  getReferralCheck.mockResolvedValue({ data: false, bindable: true });
  unregister = registerOnboardingCompletion('completion', {
    getCreatedWallet,
    getReferralCheck,
    getInviteDialog: () => showInvite,
    isClosed: () => closePage.mock.calls.length > 0,
    closePage,
    openKeylessAutoConnectDappModal: openKeylessDapp,
  });
});

afterEach(() => {
  unregister();
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

it('dismisses gift success before referral binding, then completes the original onboarding cleanup once', async () => {
  render(
    <IntlProvider locale="zh-CN" messages={zhTranslations}>
      <PrimeGiftPage />
    </IntlProvider>,
  );
  fireEvent.click(screen.getByText('Enter wallet'));
  expect(mockNavigation.pop).toHaveBeenCalledTimes(1);
  expect(showInvite).not.toHaveBeenCalled();
  expect(closePage).not.toHaveBeenCalled();
  await advance(600);
  expect(showInvite).toHaveBeenCalledTimes(1);
  expect(showInvite.mock.calls[0][0].wallet).toEqual(wallet);
  expect(closePage).not.toHaveBeenCalled();
  await enterWalletAfterOnboarding('completion');
  expect(showInvite).toHaveBeenCalledTimes(1);
  showInvite.mock.calls[0][0].onDone();
  showInvite.mock.calls[0][0].onDone();
  expect(closePage).toHaveBeenCalledTimes(1);
  expect(mockFlushToast).toHaveBeenCalledTimes(1);
  await advance(600);
  expect(openKeylessDapp).toHaveBeenCalledTimes(1);
  expect(mockNavigation.switchTabAsync).not.toHaveBeenCalled();
});

it.each([
  { data: true, bindable: false },
  { data: false, bindable: false, reason: 'already_bound' },
  { data: false, bindable: false, reason: 'exceeded_bind_window' },
  undefined,
])('enters without a dialog for referral status %j', async (status) => {
  getReferralCheck.mockResolvedValue(status);
  await enterWalletAfterOnboarding('completion');
  expect(closePage).toHaveBeenCalledTimes(1);
  expect(showInvite).not.toHaveBeenCalled();
});

it('keeps re-imported wallets outside the new-wallet referral prompt', async () => {
  getCreatedWallet.mockReturnValue(undefined);
  await enterWalletAfterOnboarding('completion');
  expect(getReferralCheck).not.toHaveBeenCalled();
  expect(closePage).toHaveBeenCalledTimes(1);
});

it('still enters when the referral check rejects', async () => {
  getReferralCheck.mockRejectedValue(new Error('offline'));
  await enterWalletAfterOnboarding('completion');
  expect(closePage).toHaveBeenCalledTimes(1);
  expect(showInvite).not.toHaveBeenCalled();
});

it('limits the referral wait to 1.5 seconds after the gift modal closes', async () => {
  getReferralCheck.mockImplementation(() => new Promise(() => {}));
  render(
    <IntlProvider locale="zh-CN" messages={zhTranslations}>
      <PrimeGiftPage />
    </IntlProvider>,
  );
  fireEvent.click(screen.getByText('Enter wallet'));
  await advance(2099);
  expect(closePage).not.toHaveBeenCalled();
  await advance(1);
  expect(closePage).toHaveBeenCalledTimes(1);
  expect(showInvite).not.toHaveBeenCalled();
});

it('does not run a stale completion if its owner unmounts during modal dismissal', async () => {
  render(
    <IntlProvider locale="zh-CN" messages={zhTranslations}>
      <PrimeGiftPage />
    </IntlProvider>,
  );
  fireEvent.click(screen.getByText('Enter wallet'));
  unregister();
  await advance(600);
  expect(getReferralCheck).not.toHaveBeenCalled();
  expect(closePage).not.toHaveBeenCalled();
  expect(mockNavigation.switchTabAsync).not.toHaveBeenCalled();
});

it('keeps device-center success going directly to Home', async () => {
  mockSource = 'deviceDetails';
  render(
    <IntlProvider locale="zh-CN" messages={zhTranslations}>
      <PrimeGiftPage />
    </IntlProvider>,
  );
  fireEvent.click(screen.getByText('Enter wallet'));
  expect(mockNavigation.switchTabAsync).toHaveBeenCalledWith(ETabRoutes.Home);
  expect(mockNavigation.pop).not.toHaveBeenCalled();
  expect(getReferralCheck).not.toHaveBeenCalled();
});

it('can exit if the originating onboarding page is no longer mounted', async () => {
  unregister();
  render(
    <IntlProvider locale="zh-CN" messages={zhTranslations}>
      <PrimeGiftPage />
    </IntlProvider>,
  );
  await act(async () => {
    fireEvent.click(screen.getByText('Enter wallet'));
  });
  expect(mockNavigation.switchTabAsync).toHaveBeenCalledWith(ETabRoutes.Home);
  expect(mockClearTransport).toHaveBeenCalledTimes(1);
});
