import { PRIME_WEB_PURCHASE_LINK_SANDBOX } from '@onekeyhq/shared/src/consts/primeConsts';
import type { IPrimeWebCheckoutPendingSession } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  resumePendingPrimeHostedCardCheckout,
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
  Promise<{
    session: IPrimeWebCheckoutPendingSession;
    reused: boolean;
    replacedSession?: IPrimeWebCheckoutPendingSession;
  }>,
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

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
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
  default: { isExtensionUiPopup: false },
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
  closeExtensionPopupAfterExpandTabOpen: jest.fn(),
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
  default: { trackPrimeSubscriptionFailed: jest.fn() },
}));

jest.mock('./primeWebCheckout', () => ({
  fetchPrimeWebCheckoutEntitlement: async () => undefined,
  getPrimeWebCheckoutPlatform: () => 'desktop',
  isPrimeWebCheckoutUserCurrent: () => mockIsUserCurrent(),
  logPrimeWebCheckoutFlow: jest.fn(),
  logPrimeWebCheckoutSessionFlow: jest.fn(),
  openPrimeWebCheckoutPage: (session: unknown, options: unknown) =>
    mockOpenPage(session, options),
  resolvePrimeWebCheckoutPackage: async () => ({
    packageId: '$rc_annual',
    offeringId: 'Sandbox_testing',
    subscriptionPeriod: 'P1Y',
    amount: 99,
    currency: 'USD',
  }),
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

function startCheckout() {
  return startPrimeHostedCardCheckout({
    intl,
    onekeyUserId: 'user-1',
    email: 'a@example.com',
    selectedSubscriptionPeriod: 'P1Y',
  });
}

describe('startPrimeHostedCardCheckout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAcquiredSessions.clear();
    mockIsUserCurrent.mockResolvedValue(true);
    mockGetPendingSession.mockResolvedValue(undefined);
    mockAcquirePendingSession.mockImplementation(async ({ session }) => {
      const stored = await mockGetPendingSession({
        onekeyUserId: session.onekeyUserId,
      });
      const previous = mockAcquiredSessions.get(session.onekeyUserId) ?? stored;
      if (
        previous?.platform === session.platform &&
        previous.isSandbox === session.isSandbox
      ) {
        return { session: previous, reused: true };
      }
      mockAcquiredSessions.set(session.onekeyUserId, session);
      return { session, reused: false, replacedSession: previous };
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

  it('keeps one pending checkout when independent surfaces start concurrently', async () => {
    await Promise.all([startCheckout(), startCheckout()]);

    const openedSessions = mockOpenPage.mock.calls.map(
      ([value]) => value as IPrimeWebCheckoutPendingSession,
    );
    expect(openedSessions).toHaveLength(2);
    expect(
      new Set(openedSessions.map(({ checkoutId }) => checkoutId)).size,
    ).toBe(1);
  });

  it('reuses the pending checkout of the same link', async () => {
    mockGetPendingSession.mockResolvedValue(previousSession);

    await startCheckout();

    expect(mockAcquirePendingSession).toHaveBeenCalledTimes(1);
    expect(mockOpenPage).toHaveBeenCalledWith(previousSession, {
      email: 'a@example.com',
      replacedSession: undefined,
    });
    expect(mockShowWaitingDialog).toHaveBeenCalledWith({
      session: previousSession,
    });
  });

  it('keeps the pending checkout when another link is selected while it remains payable', async () => {
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
    expect(mockOpenPage).toHaveBeenCalledWith(otherSession, {
      email: 'a@example.com',
      replacedSession: undefined,
    });
    expect(mockShowWaitingDialog).toHaveBeenCalledWith({
      session: otherSession,
    });
  });

  it('keeps a reused checkout when opening it fails', async () => {
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

  it('preserves a session opened by another caller when one concurrent opener fails', async () => {
    mockOpenPage.mockRejectedValueOnce(new Error('blocked'));

    await Promise.all([startCheckout(), startCheckout()]);

    const session = mockAcquiredSessions.get('user-1');
    expect(session).toBeDefined();
    expect(mockOpenPage).toHaveBeenNthCalledWith(2, session, {
      email: 'a@example.com',
      replacedSession: undefined,
    });
    expect(mockClearPendingSession).not.toHaveBeenCalled();
    expect(mockShowWaitingDialog).toHaveBeenCalledWith({ session });
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

describe('resumePendingPrimeHostedCardCheckout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsUserCurrent.mockResolvedValue(true);
  });

  it('keeps the payable hosted checkout monitored before another embedded attempt', async () => {
    mockGetPendingSession.mockResolvedValue(previousSession);

    await expect(resumePendingPrimeHostedCardCheckout('user-1')).resolves.toBe(
      true,
    );

    expect(mockClearPendingSession).not.toHaveBeenCalled();
    expect(mockShowWaitingDialog).toHaveBeenCalledWith({
      session: previousSession,
    });
  });

  it('does nothing without a user or a pending checkout', async () => {
    await expect(resumePendingPrimeHostedCardCheckout(undefined)).resolves.toBe(
      false,
    );
    mockGetPendingSession.mockResolvedValue(undefined);
    await expect(resumePendingPrimeHostedCardCheckout('user-1')).resolves.toBe(
      false,
    );

    expect(mockClearPendingSession).not.toHaveBeenCalled();
  });

  it('blocks another checkout when the pending session cannot be read', async () => {
    mockGetPendingSession.mockRejectedValue(new Error('bg unavailable'));

    await expect(
      resumePendingPrimeHostedCardCheckout('user-1'),
    ).rejects.toThrow('bg unavailable');
    expect(mockClearPendingSession).not.toHaveBeenCalled();
    expect(mockShowWaitingDialog).not.toHaveBeenCalled();
  });

  it('does not resume the previous user after the OneKey ID changes', async () => {
    mockGetPendingSession.mockResolvedValue(previousSession);
    mockIsUserCurrent.mockResolvedValue(false);

    await expect(
      resumePendingPrimeHostedCardCheckout('user-1'),
    ).rejects.toThrow('user changed');

    expect(mockClearPendingSession).not.toHaveBeenCalled();
    expect(mockShowWaitingDialog).not.toHaveBeenCalled();
  });
});
