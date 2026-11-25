import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';
import {
  getAppleStoreEnvironmentAsync,
  getInstallationTimeAsync,
} from 'expo-application';

import { appApiClient } from '../../appApiClient/appApiClient';
import appStorage from '../../storage/appStorage';

import { reportAppleAdsInstallAttribution } from './appleAds';

jest.mock('expo-application', () => ({
  getAppleStoreEnvironmentAsync: jest.fn(),
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

jest.mock('../../storage/appStorage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const getStoreEnvironmentMock = jest.mocked(getAppleStoreEnvironmentAsync);
const getInstallationTimeMock = jest.mocked(getInstallationTimeAsync);
const getClientMock = jest.mocked(appApiClient.getClient);
const getReportedMock = jest.mocked(appStorage.getItem);
const markReportedMock = jest.mocked(appStorage.setItem);
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
    getStoreEnvironmentMock.mockRejectedValue(
      new Error('StoreKit unavailable'),
    );
    getReportedMock.mockResolvedValue(null);
    markReportedMock.mockResolvedValue(undefined);
    getAttributionTokenMock.mockResolvedValue('QXBwbGVBdHRyaWJ1dGlvbkRhdGE=');
    getClientMock.mockResolvedValue({ post: postMock } as never);
    postMock.mockResolvedValue({
      data: { code: 0, data: { handled: true, delivery: 'server' } },
    });
  });

  it('marks the install handled after Utility confirms server-side delivery', async () => {
    await reportAppleAdsInstallAttribution(
      'https://utility.onekey.so',
      'installation-123',
    );

    expect(postMock).toHaveBeenCalledWith(
      '/utility/v1/install-attribution/apple-ads',
      {
        attributionToken: 'QXBwbGVBdHRyaWJ1dGlvbkRhdGE=',
        installedAt: installationTime.getTime(),
      },
      { headers: { 'x-onekey-instance-id': 'installation-123' } },
    );
    expect(markReportedMock).toHaveBeenCalledWith(
      'install_attr_apple_ads_v1',
      '1',
    );
  });

  it.each([
    undefined,
    { handled: false, delivery: 'server' },
    { handled: true, attribution: true, duplicate: false },
    { handled: true },
  ])('leaves an incomplete exchange retryable: %o', async (data) => {
    postMock.mockResolvedValueOnce({ data: { data } });

    await expect(
      reportAppleAdsInstallAttribution('https://utility.onekey.so', 'inst-1'),
    ).rejects.toThrow('Apple Ads attribution exchange is incomplete');

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

  it('uses the verified production transaction for an unknown installer', async () => {
    getInstallerPackageNameMock.mockReturnValueOnce('unknown');
    getStoreEnvironmentMock.mockResolvedValueOnce('production');

    await reportAppleAdsInstallAttribution(
      'https://utility.onekey.so',
      'inst-1',
    );

    expect(getAttributionTokenMock).toHaveBeenCalledTimes(1);
    expect(markReportedMock).toHaveBeenCalledTimes(1);
  });

  it('does not report an unknown installer with a sandbox transaction', async () => {
    getInstallerPackageNameMock.mockReturnValueOnce('unknown');
    getStoreEnvironmentMock.mockResolvedValueOnce('sandbox');

    await reportAppleAdsInstallAttribution(
      'https://utility.onekey.so',
      'inst-1',
    );

    expect(getAttributionTokenMock).not.toHaveBeenCalled();
    expect(markReportedMock).not.toHaveBeenCalled();
  });

  it('reuses the installation ID and timestamp when retrying across UTC dates', async () => {
    const installedAt = new Date('2026-11-17T12:00:00.000Z');
    getInstallationTimeMock.mockResolvedValue(installedAt);
    markReportedMock.mockRejectedValueOnce(new Error('storage unavailable'));

    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-11-17T23:59:59.000Z'));
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

    for (const retry of [1, 2]) {
      expect(postMock).toHaveBeenNthCalledWith(
        retry,
        '/utility/v1/install-attribution/apple-ads',
        expect.objectContaining({ installedAt: installedAt.getTime() }),
        { headers: { 'x-onekey-instance-id': 'inst-1' } },
      );
    }
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

  it('retries when Utility could not enqueue the event', async () => {
    postMock.mockRejectedValueOnce(new Error('queue is unavailable'));

    await expect(
      reportAppleAdsInstallAttribution('https://utility.onekey.so', 'inst-1'),
    ).rejects.toThrow('queue is unavailable');
    expect(markReportedMock).not.toHaveBeenCalled();

    await reportAppleAdsInstallAttribution(
      'https://utility.onekey.so',
      'inst-1',
    );
    expect(postMock).toHaveBeenCalledTimes(2);
    expect(markReportedMock).toHaveBeenCalledTimes(1);
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
});
