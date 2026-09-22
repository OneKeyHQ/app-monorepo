import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBus';

import ServiceHyperliquidReferral from './ServiceHyperliquidReferral';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

const emit = jest.fn();
const request = jest.fn<Promise<unknown>, [string, unknown]>();
jest.mock('@nktkas/hyperliquid/signing', () => ({
  createL1ActionHash: jest.fn(),
}));
jest.mock('@nktkas/hyperliquid', () => ({
  HttpTransport: jest.fn().mockImplementation(() => ({ request })),
}));
jest.mock('../../states/jotai/atoms', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isHdAccount: () => true,
    isHwAccount: () => false,
    isImportedAccount: () => false,
  },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  __esModule: true,
  appEventBus: {
    get emit() {
      return emit;
    },
  },
  EAppEventBusNames: { PerpsReferralBound: 'PerpsReferralBound' },
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: () => 'Failed to claim fee discount' },
    onLocaleChange: jest.fn(),
  },
}));
jest.mock('@onekeyhq/shared/src/utils/hyperLiquidErrorResolver', () => ({
  extractHyperLiquidErrorMessage: ({
    response,
  }: {
    response: { response?: string };
  }) => response.response,
  hyperLiquidErrorResolver: {
    resolveAsync: async (message: string) => ({ localizedMessage: message }),
  },
}));
jest.mock('./utils/logHyperLiquidApiFailure', () => ({
  logHyperLiquidApiFailure: jest.fn(),
  requestLoggedHyperLiquidTransport: async (
    transport: { request: typeof request },
    endpoint: string,
    payload: unknown,
  ) => transport.request(endpoint, payload),
}));

const address = `0x${'a'.repeat(40)}`;
const getReferralBannerCache = jest.fn();
const setReferralBannerCache = jest.fn();
const getReferralBannerSnoozedUntil = jest.fn();
const backgroundApi = {
  serviceAccount: {
    getNetworkAccount: jest
      .fn()
      .mockResolvedValue({ id: 'account-a', address }),
  },
  simpleDb: {
    perp: {
      getReferralBannerCache,
      setReferralBannerCache,
      getReferralBannerSnoozedUntil,
    },
  },
};

describe('referral banner reconciliation', () => {
  const previousScope = globalThis.$onekeyIsInBackground;
  let service: ServiceHyperliquidReferral;
  beforeEach(() => {
    globalThis.$onekeyIsInBackground = true;
    jest.clearAllMocks();
    getReferralBannerCache.mockResolvedValue(null);
    getReferralBannerSnoozedUntil.mockResolvedValue(0);
    request.mockReset();
    service = new ServiceHyperliquidReferral({
      backgroundApi: backgroundApi as unknown as IBackgroundApi,
    });
  });
  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousScope;
  });

  it('rechecks an old eligible cache and stops showing an already-bound account', async () => {
    getReferralBannerCache.mockResolvedValue({
      shouldShow: true,
      reason: 'eligible',
      cachedAt: Date.now(),
    });
    request.mockResolvedValueOnce({ role: 'user' }).mockResolvedValueOnce({
      referredBy: { referrer: address },
      cumVlm: '0',
    });
    await expect(
      service.checkBannerReferralEligibility({ accountId: 'account-a' }),
    ).resolves.toMatchObject({
      shouldShow: false,
      reason: 'already_has_referrer',
    });
    expect(setReferralBannerCache).toHaveBeenCalledWith(
      address,
      expect.objectContaining({
        shouldShow: false,
        reason: 'already_has_referrer',
      }),
    );
  });

  it('bypasses a cached result when checking before signing', async () => {
    getReferralBannerCache.mockResolvedValue({
      shouldShow: false,
      reason: 'already_has_referrer',
      cachedAt: Date.now(),
    });
    request
      .mockResolvedValueOnce({ role: 'user' })
      .mockResolvedValueOnce({ referredBy: null, cumVlm: '0' });
    await expect(
      service.checkBannerReferralEligibility({
        accountId: 'account-a',
        forceRefresh: true,
      }),
    ).resolves.toMatchObject({ shouldShow: true });
    expect(request).toHaveBeenCalledTimes(2);
    expect(setReferralBannerCache).not.toHaveBeenCalled();
  });

  it('confirms binding, persists it, and notifies the UI', async () => {
    request.mockResolvedValue({ referredBy: { referrer: address } });
    await expect(
      service.refreshReferralBinding({ userAddress: address }),
    ).resolves.toBe(true);
    expect(setReferralBannerCache).toHaveBeenCalledWith(
      address,
      expect.objectContaining({ shouldShow: false }),
    );
    expect(emit).toHaveBeenCalledWith(EAppEventBusNames.PerpsReferralBound, {
      userAddress: address,
    });
  });

  it('does not hide the banner when confirmation fails', async () => {
    request.mockRejectedValue(new Error('Network unavailable'));
    await expect(
      service.refreshReferralBinding({ userAddress: address }),
    ).rejects.toThrow('Failed to claim fee discount');
    expect(setReferralBannerCache).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('does not treat an unbound account as successfully bound', async () => {
    request.mockResolvedValue({ referredBy: null });
    await expect(
      service.refreshReferralBinding({ userAddress: address }),
    ).resolves.toBe(false);
    expect(setReferralBannerCache).not.toHaveBeenCalled();
  });

  it('defers already-set feedback until the UI can reconcile the binding', async () => {
    request.mockResolvedValue({
      status: 'err',
      response: 'Referrer already set',
    });
    await expect(
      service.submitSetReferrerWithSignature({
        action: { type: 'setReferrer', code: 'TEST' },
        nonce: 1,
        signatureHex: `0x${'0'.repeat(128)}1b`,
      }),
    ).rejects.toMatchObject({
      message: 'Referrer already set',
      autoToast: false,
      data: { referralAlreadySet: true },
    });
  });
});
