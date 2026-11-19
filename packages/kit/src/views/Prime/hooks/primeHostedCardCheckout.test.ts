import { PRIME_WEB_PURCHASE_LINK_SANDBOX } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IPrimeWebCheckoutPendingSession } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  handlePrimeHostedCardCheckoutFallbackRequest,
  startPrimeHostedCardCheckout,
} from './primeHostedCardCheckout';
import { buildPrimeWebPurchaseLinkUrl } from './primeWebPurchaseLink';

import type { IPrimeHostedCardCheckoutParams } from './primeHostedCardCheckout';
import type { IPrimeWebPurchaseLinkPackage } from './primeWebPurchaseLink';
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
type IResolvePackageParams = {
  subscriptionPeriod: 'P1Y' | 'P1M';
  currency?: string;
  isSandbox: boolean;
};
const mockResolvePackage = jest.fn<
  Promise<IPrimeWebPurchaseLinkPackage>,
  [IResolvePackageParams]
>();
const mockGetPaymentKey = jest.fn(async () => ({
  apiKey: 'sandbox-key',
  isSandboxKey: true,
}));

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
  getPrimePaymentApiKey: () => mockGetPaymentKey(),
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
  resolvePrimeWebCheckoutPackage: (params: IResolvePackageParams) =>
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

function startCheckout(
  overrides: Partial<IPrimeHostedCardCheckoutParams> = {},
) {
  return startPrimeHostedCardCheckout({
    intl,
    onekeyUserId: 'user-1',
    email: 'a@example.com',
    selectedSubscriptionPeriod: 'P1Y',
    ...overrides,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const concurrentSelections: {
  label: string;
  next: Partial<IPrimeHostedCardCheckoutParams>;
  initialSandbox: boolean;
  sandbox: boolean;
}[] = [
  {
    label: 'plan',
    next: { selectedSubscriptionPeriod: 'P1M' },
    initialSandbox: true,
    sandbox: true,
  },
  {
    label: 'currency',
    next: { currency: 'EUR' },
    initialSandbox: false,
    sandbox: false,
  },
  { label: 'environment', next: {}, initialSandbox: true, sandbox: false },
];

describe('startPrimeHostedCardCheckout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformEnv.isExtensionUiPopup = false;
    mockOpenExpandTab.mockResolvedValue(undefined);
    mockAcquiredSessions.clear();
    mockIsUserCurrent.mockResolvedValue(true);
    mockFetchEntitlement.mockResolvedValue(undefined);
    mockGetPaymentKey.mockResolvedValue({
      apiKey: 'sandbox-key',
      isSandboxKey: true,
    });
    mockResolvePackage.mockImplementation(
      async ({ subscriptionPeriod, currency, isSandbox }) => ({
        packageId: subscriptionPeriod === 'P1M' ? '$rc_monthly' : '$rc_annual',
        offeringId: isSandbox ? 'Sandbox_testing' : 'Default_offering',
        subscriptionPeriod,
        amount: subscriptionPeriod === 'P1M' ? 12 : 99,
        currency: currency ?? 'USD',
      }),
    );
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
    await new Promise<void>((resolve) => {
      queueMicrotask(resolve);
    });
    await new Promise<void>((resolve) => {
      queueMicrotask(resolve);
    });
    expect(mockOpenExpandTab).toHaveBeenCalledTimes(1);
    expect(mockClosePopup).not.toHaveBeenCalled();
    openTab?.();
    await completion;

    expect(mockClosePopup).toHaveBeenCalledTimes(1);
    expect(mockAcquirePendingSession).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('opens a new checkout for every rapid press of the same plan', async () => {
    await Promise.all([startCheckout(), startCheckout()]);

    const openedSessions = mockOpenPage.mock.calls.map(
      ([value]) => value as IPrimeWebCheckoutPendingSession,
    );
    expect(mockAcquirePendingSession).toHaveBeenCalledTimes(2);
    expect(openedSessions).toHaveLength(2);
    expect(openedSessions[0].checkoutId).not.toBe(openedSessions[1].checkoutId);
    expect(mockAcquiredSessions.get('user-1')).toEqual(openedSessions[1]);
  });

  it('opens a new checkout with its own plan for every rapid click', async () => {
    await Promise.all([
      startCheckout(),
      startCheckout({ selectedSubscriptionPeriod: 'P1M' }),
    ]);

    const openedSessions = mockOpenPage.mock.calls.map(
      ([value]) => value as IPrimeWebCheckoutPendingSession,
    );
    expect(openedSessions.map((item) => item.subscriptionPeriod)).toEqual([
      'P1Y',
      'P1M',
    ]);
    expect(openedSessions[1]).toMatchObject({ packageId: '$rc_monthly' });
    expect(mockAcquiredSessions.get('user-1')).toEqual(openedSessions[1]);
  });

  it.each(concurrentSelections)(
    'preserves a different $label selected while the first checkout is still starting',
    async ({ next, sandbox, initialSandbox }) => {
      const blockedPackage = deferred<IPrimeWebPurchaseLinkPackage>();
      const resolving = deferred<void>();
      mockGetPaymentKey.mockResolvedValue({
        apiKey: 'initial-key',
        isSandboxKey: initialSandbox,
      });
      mockResolvePackage.mockImplementationOnce(async () => {
        resolving.resolve();
        return blockedPackage.promise;
      });
      const first = startCheckout();
      await resolving.promise;
      mockGetPaymentKey.mockResolvedValueOnce({
        apiKey: sandbox ? 'sandbox-key' : 'production-key',
        isSandboxKey: sandbox,
      });
      const second = startCheckout(next);
      blockedPackage.resolve({
        packageId: '$rc_annual',
        offeringId: initialSandbox ? 'Sandbox_testing' : 'Default_offering',
        subscriptionPeriod: 'P1Y',
        amount: 99,
        currency: 'USD',
      });
      await Promise.all([first, second]);

      expect(mockAcquirePendingSession).toHaveBeenCalledTimes(2);
      const latest = mockAcquiredSessions.get('user-1');
      expect(latest).toMatchObject({
        subscriptionPeriod: next.selectedSubscriptionPeriod ?? 'P1Y',
        currency: next.currency ?? 'USD',
        isSandbox: sandbox,
      });
      expect(mockOpenPage).toHaveBeenLastCalledWith(latest, expect.anything());
    },
  );

  it('keeps invocation order when the later environment snapshot resolves first', async () => {
    let release!: (value: { apiKey: string; isSandboxKey: boolean }) => void;
    mockGetPaymentKey.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const first = startCheckout();
    const second = startCheckout({ selectedSubscriptionPeriod: 'P1M' });
    release({ apiKey: 'sandbox-key', isSandboxKey: true });
    await Promise.all([first, second]);
    expect(mockAcquirePendingSession).toHaveBeenCalledTimes(2);
    expect(mockAcquiredSessions.get('user-1')?.subscriptionPeriod).toBe('P1M');
  });

  it('starts every press in click order while an older selection finishes', async () => {
    await Promise.all([
      startCheckout(),
      startCheckout({ selectedSubscriptionPeriod: 'P1M' }),
      startCheckout({ selectedSubscriptionPeriod: 'P1M' }),
    ]);
    expect(
      mockAcquirePendingSession.mock.calls.map(
        ([{ session }]) => session.subscriptionPeriod,
      ),
    ).toEqual(['P1Y', 'P1M', 'P1M']);
    expect(mockAcquiredSessions.get('user-1')?.subscriptionPeriod).toBe('P1M');
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

  it('still starts the next press after an earlier start fails', async () => {
    mockOpenPage.mockRejectedValueOnce(new Error('blocked'));

    await Promise.all([startCheckout(), startCheckout()]);

    const failedSession = mockAcquirePendingSession.mock.calls[0][0].session;
    const session = mockAcquiredSessions.get('user-1');
    expect(session).toBeDefined();
    expect(session?.checkoutId).not.toBe(failedSession.checkoutId);
    expect(mockOpenPage).toHaveBeenNthCalledWith(2, session, {
      email: 'a@example.com',
      replacedSession: failedSession,
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
