/** @jest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';

import { DESKTOP_BROWSER_COMPLETION_URL } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabHomeRoutes } from '@onekeyhq/shared/src/routes';

import { openAppViaDeepLink } from '../../utils/deepLinkLaunchUtils';

import { notifyPrimeWebCheckoutReturnInExtension } from './notifyPrimeWebCheckoutReturnInExtension';
import { PrimePurchaseCompleteLandingPage } from './PrimePurchaseCompleteLandingPage';

const mockResumeWebCheckout = jest.fn<Promise<boolean>, []>(async () => false);
const mockReplaceRoute = jest.fn();
const mockSetParams = jest.fn();
const mockReplaceLocation = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    locale: 'zh-CN',
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ replace: mockReplaceRoute, setParams: mockSetParams }),
}));
jest.mock('../../../Prime/hooks/primeHostedCardCheckout', () => ({
  resumePrimeWebCheckoutAfterReturn: () => mockResumeWebCheckout(),
}));
jest.mock('./notifyPrimeWebCheckoutReturnInExtension', () => ({
  notifyPrimeWebCheckoutReturnInExtension: jest.fn(async () => false),
}));
jest.mock('../../components/DeepLinkLanding', () => ({
  DeepLinkLanding: () => null,
}));
jest.mock('../../utils/deepLinkLaunchUtils', () => ({
  openAppViaDeepLink: jest.fn(),
  scheduleDeepLinkFallbackHint: jest.fn(() => jest.fn()),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true, isWebMobile: false },
}));

const mockExtensionReturn = jest.mocked(
  notifyPrimeWebCheckoutReturnInExtension,
);
const originalLocation = globalThis.location;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockResumeWebCheckout.mockResolvedValue(false);
  mockExtensionReturn.mockResolvedValue(false);
  platformEnv.isWeb = true;
  platformEnv.isWebMobile = false;
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: {
      pathname: '/prime/purchase-complete',
      search: '?app_user_id=private-user-id&other=value',
      hash: '',
      replace: mockReplaceLocation,
    },
  });
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: originalLocation,
  });
});

async function finishReturn() {
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}

it('redirects desktop browser returns with the success scene and locale only', async () => {
  render(<PrimePurchaseCompleteLandingPage />);
  await finishReturn();
  expect(mockReplaceLocation).toHaveBeenCalledTimes(1);
  expect(mockReplaceLocation).toHaveBeenCalledWith(
    `${DESKTOP_BROWSER_COMPLETION_URL}?scene=success&locale=zh-CN`,
  );
  expect(openAppViaDeepLink).not.toHaveBeenCalled();
  expect(mockSetParams).toHaveBeenCalledWith({ app_user_id: undefined });
});

it('resumes the web checkout before considering a desktop handoff', async () => {
  mockResumeWebCheckout.mockResolvedValue(true);
  render(<PrimePurchaseCompleteLandingPage />);
  await finishReturn();
  expect(mockReplaceRoute).toHaveBeenCalledWith(ETabHomeRoutes.TabHome);
  expect(mockExtensionReturn).not.toHaveBeenCalled();
  expect(mockReplaceLocation).not.toHaveBeenCalled();
  expect(openAppViaDeepLink).not.toHaveBeenCalled();
});

it('lets the extension handle its checkout before considering a desktop handoff', async () => {
  mockExtensionReturn.mockResolvedValue(true);
  render(<PrimePurchaseCompleteLandingPage />);
  await finishReturn();
  expect(mockReplaceLocation).not.toHaveBeenCalled();
  expect(openAppViaDeepLink).not.toHaveBeenCalled();
});

it('keeps the payment deep link on mobile browsers', async () => {
  platformEnv.isWebMobile = true;
  render(<PrimePurchaseCompleteLandingPage />);
  await finishReturn();
  expect(mockReplaceLocation).not.toHaveBeenCalled();
  expect(openAppViaDeepLink).toHaveBeenCalledWith(
    expect.stringContaining('prime_purchase_complete'),
  );
});

it('does not navigate from the desktop or native app itself', async () => {
  platformEnv.isWeb = false;
  render(<PrimePurchaseCompleteLandingPage />);
  await finishReturn();
  expect(mockResumeWebCheckout).not.toHaveBeenCalled();
  expect(mockReplaceLocation).not.toHaveBeenCalled();
  expect(openAppViaDeepLink).not.toHaveBeenCalled();
});

it('does not redirect after unmount while waiting for the extension', async () => {
  let finishExtension: (handled: boolean) => void = () => {
    throw new OneKeyLocalError('Extension request was not started');
  };
  mockExtensionReturn.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishExtension = resolve;
      }),
  );
  const view = render(<PrimePurchaseCompleteLandingPage />);
  await finishReturn();
  expect(mockExtensionReturn).toHaveBeenCalledTimes(1);
  view.unmount();
  await act(async () => {
    finishExtension(false);
  });
  expect(mockReplaceLocation).not.toHaveBeenCalled();
  expect(openAppViaDeepLink).not.toHaveBeenCalled();
});
