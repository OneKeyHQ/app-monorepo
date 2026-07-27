import {
  parseGooglePlayInstallReferrer,
  reportGooglePlayInstallAttribution,
} from './reporter';

jest.mock('expo-application', () => ({
  getInstallationTimeAsync: jest.fn(),
  getInstallReferrerAsync: jest.fn(),
  nativeApplicationVersion: '6.6.0',
}));

jest.mock('../../analytics', () => ({
  analytics: {
    trackEventWithAck: jest.fn(),
  },
}));

jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeAndroidGooglePlay: true,
    isNativeMainThread: true,
  },
}));

jest.mock('../../storage/appStorage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

function createDependencies({
  reported = null,
  trackEventWithAck = jest.fn().mockResolvedValue(undefined),
}: {
  reported?: string | null;
  trackEventWithAck?: jest.Mock;
} = {}) {
  return {
    eligible: true,
    getInstallReferrer: jest
      .fn()
      .mockResolvedValue(
        'utm_source=onekey.so&utm_medium=owned_web&utm_campaign=download_page&click_id=click-123',
      ),
    getInstallationTime: jest
      .fn()
      .mockResolvedValue(new Date(1_700_000_101_000)),
    getReported: jest.fn().mockResolvedValue(reported),
    markReported: jest.fn().mockResolvedValue(undefined),
    trackEventWithAck,
    installVersion: '6.6.0',
  };
}

describe('Google Play install attribution', () => {
  it('parses only allowlisted referrer fields', () => {
    expect(
      parseGooglePlayInstallReferrer(
        'utm_source=onekey.so&utm_campaign=summer&click_id=click-123&wallet_address=secret',
      ),
    ).toEqual({
      clickId: 'click-123',
      utmCampaign: 'summer',
      utmSource: 'onekey.so',
    });
  });

  it('caps referrer values', () => {
    expect(
      parseGooglePlayInstallReferrer(`utm_campaign=${'a'.repeat(256)}`)
        .utmCampaign,
    ).toHaveLength(128);
  });

  it('reports once and marks it only after server acknowledgement', async () => {
    const dependencies = createDependencies();

    await reportGooglePlayInstallAttribution(dependencies);

    expect(dependencies.trackEventWithAck).toHaveBeenCalledWith(
      'googlePlayInstallAttribution',
      {
        appChannel: 'googlePlay',
        attributionSource: 'campaign',
        clickId: 'click-123',
        installTimestampMs: 1_700_000_101_000,
        installVersion: '6.6.0',
        utmCampaign: 'download_page',
        utmMedium: 'owned_web',
        utmSource: 'onekey.so',
      },
    );
    expect(
      dependencies.trackEventWithAck.mock.invocationCallOrder[0],
    ).toBeLessThan(dependencies.markReported.mock.invocationCallOrder[0]);
  });

  it('retries on the next launch when delivery fails', async () => {
    const dependencies = createDependencies({
      trackEventWithAck: jest
        .fn()
        .mockRejectedValue(new Error('network unavailable')),
    });

    await expect(
      reportGooglePlayInstallAttribution(dependencies),
    ).rejects.toThrow('network unavailable');
    expect(dependencies.markReported).not.toHaveBeenCalled();
  });

  it('skips ineligible and already reported installs', async () => {
    const ineligibleDependencies = createDependencies();
    ineligibleDependencies.eligible = false;
    await reportGooglePlayInstallAttribution(ineligibleDependencies);
    expect(ineligibleDependencies.getReported).not.toHaveBeenCalled();

    const reportedDependencies = createDependencies({ reported: '1' });
    await reportGooglePlayInstallAttribution(reportedDependencies);
    expect(reportedDependencies.getInstallReferrer).not.toHaveBeenCalled();
  });
});
