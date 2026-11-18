/* cspell:ignore adservices */
import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';
import { getInstallationTimeAsync } from 'expo-application';

import { appApiClient } from '../../appApiClient/appApiClient';
import appStorage from '../../storage/appStorage';

import {
  buildAppleAdsInstallAttributionParams,
  reportAppleAdsInstallAttribution,
} from './appleAds';

jest.mock('expo-application', () => ({
  getInstallationTimeAsync: jest.fn(),
}));

jest.mock('@onekeyfe/react-native-device-utils', () => ({
  ReactNativeDeviceUtils: {
    getAppleAdsAttributionToken: jest.fn(),
    getInstallerPackageName: jest.fn(),
  },
}));

jest.mock('../../appApiClient/appApiClient', () => ({
  appApiClient: {
    getClient: jest.fn(),
  },
}));

jest.mock('../../logger/logger', () => ({
  defaultLogger: {
    app: {
      install: {
        reportAppleAdsInstallAttribution: jest.fn(),
      },
    },
  },
}));

jest.mock('../../storage/appStorage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const getInstallationTimeMock = jest.mocked(getInstallationTimeAsync);
const getClientMock = jest.mocked(appApiClient.getClient);
const getReportedMock = jest.mocked(appStorage.getItem);
const markReportedMock = jest.mocked(appStorage.setItem);
const mockedLoggerModule = jest.requireMock('../../logger/logger') as {
  defaultLogger: {
    app: {
      install: {
        reportAppleAdsInstallAttribution: jest.Mock;
      };
    };
  };
};
const logAppleAdsAttributionMock =
  mockedLoggerModule.defaultLogger.app.install.reportAppleAdsInstallAttribution;
const postMock = jest.fn();
const getAttributionTokenMock = jest.spyOn(
  ReactNativeDeviceUtils,
  'getAppleAdsAttributionToken',
);
const getInstallerPackageNameMock = jest.spyOn(
  ReactNativeDeviceUtils,
  'getInstallerPackageName',
);
const installationTime = new Date();

describe('Apple Ads install attribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInstallationTimeMock.mockResolvedValue(installationTime);
    getInstallerPackageNameMock.mockReturnValue('appStore');
    getReportedMock.mockResolvedValue(null);
    markReportedMock.mockResolvedValue(undefined);
    logAppleAdsAttributionMock.mockResolvedValue(undefined);
    getAttributionTokenMock.mockResolvedValue('QXBwbGVBdHRyaWJ1dGlvbkRhdGE=');
    getClientMock.mockResolvedValue({ post: postMock } as never);
    postMock.mockResolvedValue({
      data: {
        code: 0,
        data: {
          handled: true,
          attribution: true,
          duplicate: false,
          attributionData: {
            orgId: '40669820',
            campaignId: '542370539',
            adGroupId: '542317095',
            keywordId: '87675432',
            adId: '542317136',
            conversionType: 'Download',
            claimType: 'Click',
            countryOrRegion: 'US',
            supplyPlacement: 'APPSTORE_SEARCH_RESULTS',
            clickDate: '2024-10-08T17:17:00.000Z',
          },
        },
      },
    });
  });

  it('submits the opaque token, forwards attributed installs to analytics, and marks success', async () => {
    await reportAppleAdsInstallAttribution(
      'https://utility.onekey.so',
      'installation-123',
    );

    expect(postMock).toHaveBeenCalledWith(
      '/utility/v1/install-attribution/apple-ads',
      { attributionToken: 'QXBwbGVBdHRyaWJ1dGlvbkRhdGE=' },
      { headers: { 'x-onekey-instance-id': 'installation-123' } },
    );
    expect(logAppleAdsAttributionMock).toHaveBeenCalledWith({
      $insertId: 'apple_ads_install_attr:installation-123',
      $timestamp: installationTime.getTime(),
      adGroupId: '542317095',
      adId: '542317136',
      attributionSource: 'apple_ads_adservices',
      campaignId: '542370539',
      claimType: 'Click',
      clickDate: '2024-10-08T17:17:00.000Z',
      conversionType: 'Download',
      countryOrRegion: 'US',
      keywordId: '87675432',
      orgId: '40669820',
      supplyPlacement: 'APPSTORE_SEARCH_RESULTS',
      utmCampaign: '542370539',
      utmContent: '542317136',
      utmMedium: 'APPSTORE_SEARCH_RESULTS',
      utmSource: 'apple_ads',
      utmTerm: '87675432',
    });
    expect(markReportedMock).toHaveBeenCalledWith(
      'install_attr_apple_ads_v1',
      '1',
    );
  });

  it('marks unattributed organic installs handled without emitting an analytics event', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        code: 0,
        data: {
          handled: true,
          attribution: false,
          duplicate: false,
        },
      },
    });

    await reportAppleAdsInstallAttribution(
      'https://utility.onekey.so',
      'installation-123',
    );

    expect(logAppleAdsAttributionMock).not.toHaveBeenCalled();
    expect(markReportedMock).toHaveBeenCalledWith(
      'install_attr_apple_ads_v1',
      '1',
    );
  });

  it.each([
    undefined,
    { handled: false, attribution: false },
    { handled: true },
  ])('leaves an incomplete exchange retryable: %o', async (data) => {
    postMock.mockResolvedValueOnce({ data: { data } });

    await expect(
      reportAppleAdsInstallAttribution('https://utility.onekey.so', 'inst-1'),
    ).rejects.toThrow('Apple Ads attribution exchange is incomplete');

    expect(logAppleAdsAttributionMock).not.toHaveBeenCalled();
    expect(markReportedMock).not.toHaveBeenCalled();
  });

  it.each(['testFlight', 'other', 'unknown'] as const)(
    'skips an installation from %s before fetching a token',
    async (installer) => {
      getInstallerPackageNameMock.mockReturnValueOnce(installer);

      await reportAppleAdsInstallAttribution(
        'https://utility.onekey.so',
        'inst-1',
      );

      expect(getInstallationTimeMock).not.toHaveBeenCalled();
      expect(getAttributionTokenMock).not.toHaveBeenCalled();
      expect(postMock).not.toHaveBeenCalled();
      expect(markReportedMock).not.toHaveBeenCalled();
    },
  );

  it('reuses the install event ID and timestamp when retrying across UTC dates', async () => {
    const installedAt = new Date('2026-11-17T12:00:00.000Z');
    getInstallationTimeMock.mockResolvedValue(installedAt);
    markReportedMock.mockRejectedValueOnce(new Error('storage unavailable'));

    jest.useFakeTimers({ now: new Date('2026-11-17T23:59:59.000Z') });
    try {
      await expect(
        reportAppleAdsInstallAttribution('https://utility.onekey.so', 'inst-1'),
      ).rejects.toThrow('storage unavailable');
      jest.setSystemTime(new Date('2026-11-18T00:00:01.000Z'));
      await reportAppleAdsInstallAttribution(
        'https://utility.onekey.so',
        'inst-1',
      );
    } finally {
      jest.useRealTimers();
    }

    const eventIdentity = expect.objectContaining({
      $insertId: 'apple_ads_install_attr:inst-1',
      $timestamp: installedAt.getTime(),
    });
    expect(logAppleAdsAttributionMock).toHaveBeenNthCalledWith(
      1,
      eventIdentity,
    );
    expect(logAppleAdsAttributionMock).toHaveBeenNthCalledWith(
      2,
      eventIdentity,
    );
  });

  it('does not mark the request handled when utility delivery fails', async () => {
    postMock.mockRejectedValueOnce(new Error('network failed'));

    await expect(
      reportAppleAdsInstallAttribution(
        'https://utility.onekey.so',
        'installation-123',
      ),
    ).rejects.toThrow('network failed');

    expect(markReportedMock).not.toHaveBeenCalled();
  });

  it('does not mark the request handled when analytics delivery fails', async () => {
    logAppleAdsAttributionMock.mockRejectedValueOnce(
      new Error('track event failed'),
    );

    await expect(
      reportAppleAdsInstallAttribution(
        'https://utility.onekey.so',
        'installation-123',
      ),
    ).rejects.toThrow('track event failed');

    expect(markReportedMock).not.toHaveBeenCalled();
  });

  it('marks an old installation without requesting a token', async () => {
    getInstallationTimeMock.mockResolvedValue(
      new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    );

    await reportAppleAdsInstallAttribution(
      'https://utility.onekey.so',
      'installation-123',
    );

    expect(getAttributionTokenMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
    expect(logAppleAdsAttributionMock).not.toHaveBeenCalled();
    expect(markReportedMock).toHaveBeenCalledWith(
      'install_attr_apple_ads_v1',
      '1',
    );
  });

  it('skips attribution already handled', async () => {
    getReportedMock.mockResolvedValue('1');

    await reportAppleAdsInstallAttribution(
      'https://utility.onekey.so',
      'installation-123',
    );

    expect(getInstallationTimeMock).not.toHaveBeenCalled();
    expect(getAttributionTokenMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('does not mark a missing attribution token as handled', async () => {
    getAttributionTokenMock.mockResolvedValueOnce(undefined);

    await expect(
      reportAppleAdsInstallAttribution(
        'https://utility.onekey.so',
        'installation-123',
      ),
    ).rejects.toThrow('Apple Ads attribution token is empty');

    expect(postMock).not.toHaveBeenCalled();
    expect(markReportedMock).not.toHaveBeenCalled();
  });

  it('does not mark a failed token request as handled', async () => {
    getAttributionTokenMock.mockRejectedValueOnce(
      new Error('AdServices failed'),
    );

    await expect(
      reportAppleAdsInstallAttribution(
        'https://utility.onekey.so',
        'installation-123',
      ),
    ).rejects.toThrow('AdServices failed');

    expect(postMock).not.toHaveBeenCalled();
    expect(markReportedMock).not.toHaveBeenCalled();
  });

  it('bounds and normalizes Apple Ads attribution fields', () => {
    expect(
      buildAppleAdsInstallAttributionParams(
        'inst-1',
        installationTime.getTime(),
        {
          campaignId: ` ${'1'.repeat(200)} `,
          claimType: 'Impression',
        },
      ),
    ).toEqual({
      $insertId: 'apple_ads_install_attr:inst-1',
      $timestamp: installationTime.getTime(),
      attributionSource: 'apple_ads_adservices',
      campaignId: '1'.repeat(128),
      claimType: 'Impression',
      utmCampaign: '1'.repeat(128),
      utmMedium: 'Impression',
      utmSource: 'apple_ads',
    });
  });
});
