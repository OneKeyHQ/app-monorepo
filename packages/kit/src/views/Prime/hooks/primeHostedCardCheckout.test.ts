import { PRIME_WEB_PURCHASE_LINK_SANDBOX } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IPrimeWebCheckoutPendingSession } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  discardPrimeHostedCardCheckout,
  handlePrimeHostedCardCheckoutFallbackRequest,
  startPrimeHostedCardCheckout,
} from './primeHostedCardCheckout';
import { buildPrimeWebPurchaseLinkUrl } from './primeWebPurchaseLink';

import type { IntlShape } from 'react-intl';

/*
yarn test packages/kit/src/views/Prime/hooks/primeHostedCardCheckout.test.ts
*/

const mockGetPendingSession = jest.fn<
  Promise<IPrimeWebCheckoutPendingSession | undefined>,
  [unknown]
>();
const mockAcquiredSessions = new Map<string, IPrimeWebCheckoutPendingSession>();
const mockAcquirePendingSession = jest.fn<
  Promise<{ replacedSession?: IPrimeWebCheckoutPendingSession }>,
  [{ session: IPrimeWebCheckoutPendingSession }]
>();
const mockClearPendingSession = jest.fn<Promise<boolean>, [unknown]>(
  async () => true,
);
const mockOpenPage = jest.fn<
  Promise<'opened' | 'navigatedAway'>,
  [unknown, unknown]
>(async () => 'opened');
const mockShowWaitingDialog = jest.fn<void, [unknown]>();
const mockToastError = jest.fn<void, [unknown]>();
const mockIsUserCurrent = jest.fn(async () => true);
const mockPlatformEnv = { isExtensionUiPopup: false };
const mockOpenExpandTab = jest.fn<Promise<void>, [unknown]>();
const mockClosePopup = jest.fn<void, []>();
const mockTrackFailure = jest.fn<void, [unknown]>();
const mockFetchEntitlement = jest.fn<
  Promise<{ isActive: boolean } | undefined>,
  [unknown]
>();
const mockResolvePackage = jest.fn(
  async ({ subscriptionPeriod }: { subscriptionPeriod?: string }) =>
    subscriptionPeriod === 'P1M'
      ? {
          packageId: '$rc_monthly',
          offeringId: 'Sandbox_testing',
          subscriptionPeriod: 'P1M' as const,
          amount: 12,
          currency: 'USD',
        }
      : {
          packageId: '$rc_annual',
          offeringId: 'Sandbox_testing',
          subscriptionPeriod: 'P1Y' as const,
          amount: 99,
          currency: 'USD',
        },
);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApp: {
      openExtensionExpandTab: (params: unknown) => mockOpenExpandTab(params),
    },
    simpleDb: {
      prime: {
        getWebCheckoutPendingSession: (params: unknown) =>
          mockGetPendingSession(params),
        acquireWebCheckoutPendingSession: (params: {
          session: IPrimeWebCheckoutPendingSession;
        }) => mockAcquirePendingSession(params),
        clearWebCheckoutPendingSession: (params: unknown) =>
          mockClearPendingSession(params),
      },
    },
  },
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: jest.fn() },
  Toast: {
    message: jest.fn(),
    error: (params: unknown) => mockToastError(params),
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isExtensionUiPopup() {
      return mockPlatformEnv.isExtensionUiPopup;
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: { subscription: { primeSubscribeIntent: jest.fn() } },
  },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { emitToSelf: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/utils/extUtils', () => ({
  closeExtensionPopupAfterExpandTabOpen: () => mockClosePopup(),
}));

jest.mock('../components/PrimeWebCheckoutWaitingDialog', () => ({
  showPrimeWebCheckoutWaitingDialog: (params: unknown) =>
    mockShowWaitingDialog(params),
}));

jest.mock('../primeSubscriptionPurchaseSuccess', () => ({
  refreshPrimeUserInfoAfterPurchase: jest.fn(),
}));

jest.mock('./getPrimePaymentApiKey', () => ({
  getPrimePaymentApiKey: async () => ({ isSandboxKey: true }),
}));

jest.mock('./primePaymentUtils', () => ({
  __esModule: true,
  default: {
    trackPrimeSubscriptionFailed: (params: unknown) => mockTrackFailure(params),
  },
}));

jest.mock('./primeWebCheckout', () => ({
  fetchPrimeWebCheckoutEntitlement: (params: unknown) =>
    mockFetchEntitlement(params),
  getPrimeWebCheckoutPlatform: () => 'desktop',
  isPrimeWebCheckoutUserCurrent: () => mockIsUserCurrent(),
  logPrimeWebCheckoutFlow: jest.fn(),
  logPrimeWebCheckoutSessionFlow: jest.fn(),
  openPrimeWebCheckoutPage: (session: unknown, options: unknown) =>
    mockOpenPage(session, options),
  resolvePrimeWebCheckoutPackage: (params: { subscriptionPeriod?: string }) =>
    mockResolvePackage(params),
}));

const intl = { formatMessage: jest.fn(() => '') } as unknown as IntlShape;
const checkoutUrl = buildPrimeWebPurchaseLinkUrl({
  config: PRIME_WEB_PURCHASE_LINK_SANDBOX,
  onekeyUserId: 'user-1',
  packageId: '$rc_annual',
  platform: 'desktop',
});
const previousSession: IPrimeWebCheckoutPendingSession = {
  checkoutId: 'checkout-0',
  onekeyUserId: 'user-1',
  subscriptionPeriod: 'P1Y',
  packageId: '$rc_annual',
  offeringId: 'Sandbox_testing',
  amount: 99,
  currency: 'USD',
  isSandbox: true,
  platform: 'desktop',
  checkoutUrl,
  startedAt: Date.now() - 60_000,
};

function startCheckout(selectedSubscriptionPeriod: 'P1Y' | 'P1M' = 'P1Y') {
  return startPrimeHostedCardCheckout({
    intl,
    onekeyUserId: 'user-1',
    email: 'a@example.com',
    selectedSubscriptionPeriod,
  });
}

describe('startPrimeHostedCardCheckout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformEnv.isExtensionUiPopup = false;
    mockOpenExpandTab.mockResolvedValue(undefined);
    mockAcquiredSessions.clear();
    mockIsUserCurrent.mockResolvedValue(true);
    mockFetchEntitlement.mockResolvedValue(undefined);
    mockGetPendingSession.mockResolvedValue(undefined);
    mockAcquirePendingSession.mockImplementation(async ({ session }) => {
      const stored = await mockGetPendingSession({
        onekeyUserId: session.onekeyUserId,
      });
      const previous = mockAcquiredSessions.get(session.onekeyUserId) ?? stored;
      mockAcquiredSessions.set(session.onekeyUserId, session);
      return { replacedSession: previous };
    });
  });

  it('stores the link without the email and opens it with the email', async () => {
    await startCheckout();

    const { session } = mockAcquirePendingSession.mock.calls[0][0];
    expect(session.checkoutUrl).toBe(checkoutUrl);
    expect(session.checkoutUrl).not.toContain('email');
    expect(mockOpenPage).toHaveBeenCalledWith(session, {
      email: 'a@example.com',
      replacedSession: undefined,
    });
    expect(mockShowWaitingDialog).toHaveBeenCalledWith({ session });
  });

  it('uses the host-resolved package when bridge data mislabels a monthly package as annual', async () => {
    await startPrimeHostedCardCheckout({
      intl,
      onekeyUserId: 'user-1',
      selectedSubscriptionPeriod: 'P1Y',
      purchasePackage: {
        packageId: '$rc_monthly',
        offeringId: 'Sandbox_testing',
        subscriptionPeriod: 'P1Y',
        amount: 0.01,
        currency: 'JPY',
      },
    });

    const { session } = mockAcquirePendingSession.mock.calls[0][0];
    expect(session).toMatchObject({
      packageId: '$rc_annual',
      subscriptionPeriod: 'P1Y',
      amount: 99,
      currency: 'USD',
      checkoutUrl,
    });
  });

  it('does not use a bridge package after trusted package resolution fails', async () => {
    mockResolvePackage.mockRejectedValueOnce(
      new OneKeyLocalError('Offering unavailable'),
    );

    await startPrimeHostedCardCheckout({
      intl,
      onekeyUserId: 'user-1',
      selectedSubscriptionPeriod: 'P1Y',
      purchasePackage: previousSession,
    });

    expect(mockAcquirePendingSession).not.toHaveBeenCalled();
    expect(mockOpenPage).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledTimes(1);
  });

  it('refuses a bridge request that changes the host-selected billing period', async () => {
    await handlePrimeHostedCardCheckoutFallbackRequest({
      intl,
      routePrimeUserId: 'user-1',
      routePrimeUserEmail: 'a@example.com',
      routeSubscriptionPeriod: 'P1Y',
      params: {
        trigger: 'checkoutError',
        onekeyUserId: 'user-1',
        subscriptionPeriod: 'P1M',
      },
    });

    expect(mockResolvePackage).not.toHaveBeenCalled();
    expect(mockOpenPage).not.toHaveBeenCalled();
  });

  it('reports popup handoff failure without rejecting or starting a checkout', async () => {
    mockPlatformEnv.isExtensionUiPopup = true;
    const error = new OneKeyLocalError('Expand tab unavailable');
    mockOpenExpandTab.mockRejectedValueOnce(error);

    await expect(startCheckout()).resolves.toBeUndefined();

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockTrackFailure).toHaveBeenCalledWith(
      expect.objectContaining({ error, cardCheckoutFlow: 'hostedLink' }),
    );
    expect(mockClosePopup).not.toHaveBeenCalled();
    expect(mockAcquirePendingSession).not.toHaveBeenCalled();
    expect(mockOpenPage).not.toHaveBeenCalled();
    expect(mockShowWaitingDialog).not.toHaveBeenCalled();
  });

  it('only closes the popup after the expand tab opens successfully', async () => {
    mockPlatformEnv.isExtensionUiPopup = true;
    let openTab: (() => void) | undefined;
    mockOpenExpandTab.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          openTab = resolve;
        }),
    );

    const completion = startCheckout();
    expect(mockOpenExpandTab).toHaveBeenCalledTimes(1);
    expect(mockClosePopup).not.toHaveBeenCalled();
    openTab?.();
    await completion;

    expect(mockClosePopup).toHaveBeenCalledTimes(1);
    expect(mockAcquirePendingSession).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('opens a new checkout with its own plan for every rapid click', async () => {
    await Promise.all([startCheckout('P1Y'), startCheckout('P1M')]);

    const openedSessions = mockOpenPage.mock.calls.map(
      ([value]) => value as IPrimeWebCheckoutPendingSession,
    );
    expect(openedSessions).toHaveLength(2);
    expect(openedSessions[0].checkoutId).not.toBe(openedSessions[1].checkoutId);
    expect(openedSessions[0]).toMatchObject({
      subscriptionPeriod: 'P1Y',
      packageId: '$rc_annual',
    });
    expect(openedSessions[1]).toMatchObject({
      subscriptionPeriod: 'P1M',
      packageId: '$rc_monthly',
    });
    expect(mockAcquiredSessions.get('user-1')).toEqual(openedSessions[1]);
  });

  it('does not open another checkout for an active subscriber', async () => {
    mockFetchEntitlement.mockResolvedValueOnce({ isActive: true });

    await startCheckout();

    expect(mockAcquirePendingSession).not.toHaveBeenCalled();
    expect(mockOpenPage).not.toHaveBeenCalled();
  });

  it('starts a fresh checkout on re-entry after the first one opened', async () => {
    await startCheckout();
    await startCheckout();

    const first = mockAcquirePendingSession.mock.calls[0][0].session;
    const second = mockAcquirePendingSession.mock.calls[1][0].session;
    expect(second.checkoutId).not.toBe(first.checkoutId);
    expect(mockOpenPage).toHaveBeenNthCalledWith(2, second, {
      email: 'a@example.com',
      replacedSession: first,
    });
  });

  it('starts a fresh attempt even when the previous plan and link match', async () => {
    mockGetPendingSession.mockResolvedValue(previousSession);

    await startCheckout();

    expect(mockAcquirePendingSession).toHaveBeenCalledTimes(1);
    const { session } = mockAcquirePendingSession.mock.calls[0][0];
    expect(session.checkoutId).not.toBe(previousSession.checkoutId);
    expect(mockOpenPage).toHaveBeenCalledWith(session, {
      email: 'a@example.com',
      replacedSession: previousSession,
    });
    expect(mockShowWaitingDialog).toHaveBeenCalledWith({
      session,
    });
  });

  it('uses the newly selected plan instead of a payable previous plan', async () => {
    const otherSession = {
      ...previousSession,
      subscriptionPeriod: 'P1M' as const,
      packageId: '$rc_monthly',
      checkoutUrl: buildPrimeWebPurchaseLinkUrl({
        config: PRIME_WEB_PURCHASE_LINK_SANDBOX,
        onekeyUserId: 'user-1',
        packageId: '$rc_monthly',
        platform: 'desktop',
      }),
    };
    mockGetPendingSession.mockResolvedValue(otherSession);

    await startCheckout();

    expect(mockAcquirePendingSession).toHaveBeenCalledTimes(1);
    const { session } = mockAcquirePendingSession.mock.calls[0][0];
    expect(session).toMatchObject({
      subscriptionPeriod: 'P1Y',
      packageId: '$rc_annual',
      checkoutUrl,
    });
    expect(mockOpenPage).toHaveBeenCalledWith(session, {
      email: 'a@example.com',
      replacedSession: otherSession,
    });
    expect(mockShowWaitingDialog).toHaveBeenCalledWith({
      session,
    });
  });

  it('keeps the new attempt recoverable when replacing an old checkout fails to open', async () => {
    mockGetPendingSession.mockResolvedValue(previousSession);
    mockOpenPage.mockRejectedValueOnce(new Error('blocked'));

    await startCheckout();

    expect(mockClearPendingSession).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalled();
  });

  it('keeps a new checkout recoverable when opening it fails', async () => {
    mockOpenPage.mockRejectedValueOnce(new Error('blocked'));

    await startCheckout();

    const { session } = mockAcquirePendingSession.mock.calls[0][0];
    expect(mockAcquiredSessions.get('user-1')).toEqual(session);
    expect(mockClearPendingSession).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalled();
  });

  it('does not open a checkout if the account changes during session acquisition', async () => {
    mockIsUserCurrent.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await startCheckout();

    expect(mockAcquirePendingSession).toHaveBeenCalledTimes(1);
    expect(mockOpenPage).not.toHaveBeenCalled();
    expect(mockClearPendingSession).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalled();
  });
});

describe('discardPrimeHostedCardCheckout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPendingSession.mockResolvedValue(previousSession);
  });

  it('clears the current hosted record by its checkout id', async () => {
    await discardPrimeHostedCardCheckout('user-1');

    expect(mockGetPendingSession).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
    });
    expect(mockClearPendingSession).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      expectedCheckoutId: previousSession.checkoutId,
    });
  });

  it('does nothing without a signed-in user or a hosted record', async () => {
    await discardPrimeHostedCardCheckout(undefined);
    mockGetPendingSession.mockResolvedValueOnce(undefined);
    await discardPrimeHostedCardCheckout('user-1');

    expect(mockGetPendingSession).toHaveBeenCalledTimes(1);
    expect(mockClearPendingSession).not.toHaveBeenCalled();
  });

  it('never blocks the new payment when storage fails', async () => {
    mockGetPendingSession.mockRejectedValueOnce(new Error('bg unavailable'));

    await expect(
      discardPrimeHostedCardCheckout('user-1'),
    ).resolves.toBeUndefined();
    expect(mockClearPendingSession).not.toHaveBeenCalled();
  });
});
