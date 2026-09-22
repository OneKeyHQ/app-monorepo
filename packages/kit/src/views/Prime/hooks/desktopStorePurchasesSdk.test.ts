import { createIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';
import zhMessages from '@onekeyhq/shared/src/locale/json/zh_CN.json';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';
import type { IRevenueCatPackage } from '@onekeyhq/shared/types/prime/revenueCat';

import { createDesktopStorePurchasesSdk } from './desktopStorePurchasesSdk';

const mockGetActiveAuthToken = jest.fn(async () => 'not-forwarded-to-ipc');
const mockGetAuthSessionSource = jest.fn<
  Promise<EPrimeAuthSessionSource | undefined>,
  []
>(async () => EPrimeAuthSessionSource.KeylessOAuth);
const mockGetDevSetting = jest.fn(async () => ({
  enabled: false,
  settings: { enableTestEndpoint: false },
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    simpleDb: {
      prime: {
        getActiveAuthToken: () => mockGetActiveAuthToken(),
        getAuthSessionSource: () => mockGetAuthSessionSource(),
      },
    },
    serviceDevSetting: { getDevSetting: () => mockGetDevSetting() },
    serviceSetting: { getInstanceId: async () => 'instance-a' },
  },
}));

let desktopStorePurchasesSdk: ReturnType<typeof createDesktopStorePurchasesSdk>;
const enTranslations: Record<string, string> = enMessages;
const zhTranslations: Record<string, string> = zhMessages;
const testLocales = [
  { locale: 'en-US', messages: enTranslations },
  { locale: 'zh-CN', messages: zhTranslations },
];

const mockApi = {
  revenueCatLogInWithVerifiedSession: jest.fn(
    async (_params: unknown) => undefined,
  ),
  revenueCatSupportsVerifiedIdentity: jest.fn(async () => true),
  revenueCatConfigure: jest.fn(async (_params: unknown) => undefined),
  revenueCatGetCustomerInfo: jest.fn(async (_params: unknown) => undefined),
  revenueCatPurchasePackage: jest.fn<Promise<unknown>, [unknown]>(),
  revenueCatRestorePurchases: jest.fn<Promise<unknown>, [unknown]>(),
  revenueCatSetAttributes: jest.fn(async (_params: unknown) => undefined),
  revenueCatCheckTrialOrIntroductoryPriceEligibility: jest.fn<
    Promise<Record<string, { status: number }>>,
    [unknown]
  >(),
};

const pkg: IRevenueCatPackage = {
  identifier: '$rc_annual',
  presentedOfferingContext: { offeringIdentifier: 'default' },
  product: {
    identifier: 'prime.yearly',
    subscriptionPeriod: 'P1Y',
    pricePerMonth: 8.25,
    pricePerYear: 99,
    currencyCode: 'USD',
    introPrice: null,
  },
};

describe('desktop RevenueCat adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    mockGetDevSetting.mockResolvedValue({
      enabled: false,
      settings: { enableTestEndpoint: false },
    });
    desktopStorePurchasesSdk = createDesktopStorePurchasesSdk(
      createIntl({ locale: 'zh-CN', messages: zhTranslations }),
    );
    mockApi.revenueCatSupportsVerifiedIdentity.mockResolvedValue(true);
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: { inAppPurchase: mockApi },
    });
  });

  it.each(testLocales)(
    'localizes unavailable bridge feedback in $locale',
    async ({ locale, messages }) => {
      desktopStorePurchasesSdk = createDesktopStorePurchasesSdk(
        createIntl({ locale, messages }),
      );
      mockApi.revenueCatSupportsVerifiedIdentity.mockResolvedValue(false);
      await expect(
        desktopStorePurchasesSdk.configure({ apiKey: 'apple-key' }),
      ).rejects.toThrow(
        messages[ETranslations.global_update_to_continue_desc_fallback],
      );
      expect(mockApi.revenueCatConfigure).not.toHaveBeenCalled();
    },
  );

  it.each(testLocales)(
    'localizes missing offering feedback in $locale without calling native purchase',
    ({ locale, messages }) => {
      desktopStorePurchasesSdk = createDesktopStorePurchasesSdk(
        createIntl({ locale, messages }),
      );
      expect(() =>
        desktopStorePurchasesSdk.purchasePackage(
          { ...pkg, presentedOfferingContext: null },
          'user-a',
        ),
      ).toThrow(messages[ETranslations.prime_payment_start_failed__msg]);
      expect(mockApi.revenueCatPurchasePackage).not.toHaveBeenCalled();
    },
  );

  it('passes the offering and expected account to native purchase', async () => {
    mockApi.revenueCatPurchasePackage.mockResolvedValue({ customerInfo: {} });
    await desktopStorePurchasesSdk.purchasePackage(pkg, 'user-a');
    expect(mockApi.revenueCatPurchasePackage).toHaveBeenCalledWith({
      packageIdentifier: '$rc_annual',
      offeringIdentifier: 'default',
      expectedAppUserId: 'user-a',
    });
  });

  it('reports an unsupported older application shell clearly', async () => {
    mockApi.revenueCatSupportsVerifiedIdentity.mockRejectedValueOnce(
      new Error('Unknown IPC method'),
    );
    await expect(
      desktopStorePurchasesSdk.configure({ apiKey: 'apple-key' }),
    ).rejects.toThrow(
      zhMessages[ETranslations.global_update_to_continue_desc_fallback],
    );
    expect(mockApi.revenueCatConfigure).not.toHaveBeenCalled();
  });

  it('preserves user cancellation after desktop IPC serialization', async () => {
    const error = Object.assign(new Error('Purchase cancelled'), {
      code: '1',
      data: { revenueCat: true, userCancelled: true },
    });
    mockApi.revenueCatPurchasePackage.mockRejectedValue(error);
    await expect(
      desktopStorePurchasesSdk.purchasePackage(pkg, 'user-a'),
    ).rejects.toMatchObject({ userCancelled: true, code: '1' });
  });

  it('binds customer reads, restore and analytics to the expected account', async () => {
    await desktopStorePurchasesSdk.getCustomerInfo('user-a');
    await desktopStorePurchasesSdk.restorePurchases('user-a');
    await desktopStorePurchasesSdk.setMixpanelDistinctID(
      'instance-a',
      'user-a',
    );
    await desktopStorePurchasesSdk.setAttributes(
      { '$posthogUserId': 'instance-a' },
      'user-a',
    );
    expect(mockApi.revenueCatGetCustomerInfo).toHaveBeenCalledWith({
      expectedAppUserId: 'user-a',
    });
    expect(mockApi.revenueCatRestorePurchases).toHaveBeenCalledWith({
      expectedAppUserId: 'user-a',
    });
    expect(mockApi.revenueCatSetAttributes.mock.calls).toEqual([
      [
        {
          attributes: { '$mixpanelDistinctId': 'instance-a' },
          expectedAppUserId: 'user-a',
        },
      ],
      [
        {
          attributes: { '$posthogUserId': 'instance-a' },
          expectedAppUserId: 'user-a',
        },
      ],
    ]);
  });

  it('shows trial prices only when Apple reports eligibility', async () => {
    mockApi.revenueCatCheckTrialOrIntroductoryPriceEligibility.mockResolvedValue(
      {
        'prime.yearly': { status: 2 },
      },
    );
    await expect(
      desktopStorePurchasesSdk.getIntroEligibleProductIds([pkg]),
    ).resolves.toEqual(new Set(['prime.yearly']));
    mockApi.revenueCatCheckTrialOrIntroductoryPriceEligibility.mockResolvedValue(
      {
        'prime.yearly': { status: 0 },
      },
    );
    await expect(
      desktopStorePurchasesSdk.getIntroEligibleProductIds([pkg]),
    ).resolves.toEqual(new Set());
    mockApi.revenueCatCheckTrialOrIntroductoryPriceEligibility.mockRejectedValue(
      new Error('offline'),
    );
    await expect(
      desktopStorePurchasesSdk.getIntroEligibleProductIds([pkg]),
    ).resolves.toEqual(new Set());
  });
});

describe('desktop identity handoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    mockGetDevSetting.mockResolvedValue({
      enabled: false,
      settings: { enableTestEndpoint: false },
    });
    desktopStorePurchasesSdk = createDesktopStorePurchasesSdk(
      createIntl({ locale: 'zh-CN', messages: zhTranslations }),
    );
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: { inAppPurchase: mockApi },
    });
  });

  it('refreshes the stored session and passes only context selectors to main', async () => {
    await desktopStorePurchasesSdk.logIn('user-a');
    expect(mockGetActiveAuthToken).toHaveBeenCalledTimes(1);
    expect(mockApi.revenueCatLogInWithVerifiedSession).toHaveBeenCalledWith({
      expectedAppUserId: 'user-a',
      authContext: {
        sessionSource: EPrimeAuthSessionSource.KeylessOAuth,
        endpointEnv: 'prod',
        instanceId: 'instance-a',
      },
    });
    expect(
      JSON.stringify(mockApi.revenueCatLogInWithVerifiedSession.mock.calls),
    ).not.toContain('not-forwarded-to-ipc');
  });

  it('does not invoke main login without an active OneKey session source', async () => {
    mockGetAuthSessionSource.mockResolvedValue(undefined);
    await expect(desktopStorePurchasesSdk.logIn('user-a')).rejects.toThrow(
      zhMessages[ETranslations.prime_onekey_id_session_changed__msg],
    );
    expect(mockApi.revenueCatLogInWithVerifiedSession).not.toHaveBeenCalled();
  });

  it('preserves native identity-confirmation cancellation', async () => {
    mockApi.revenueCatLogInWithVerifiedSession.mockRejectedValueOnce(
      Object.assign(new Error('Cancel'), {
        data: { revenueCat: true, userCancelled: true },
      }),
    );
    await expect(
      desktopStorePurchasesSdk.logIn('user-a'),
    ).rejects.toMatchObject({ userCancelled: true });
  });
});
