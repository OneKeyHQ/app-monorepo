import { getInstallationTimeAsync } from 'expo-application';
import { NativeModules } from 'react-native';

import { appApiClient } from '../../appApiClient/appApiClient';
import appStorage from '../../storage/appStorage';

import { reportAppleAdsInstallAttribution } from './appleAds';

jest.mock('expo-application', () => ({
  getInstallationTimeAsync: jest.fn(),
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

const getInstallationTimeMock = jest.mocked(getInstallationTimeAsync);
const getReportedMock = jest.mocked(appStorage.getItem);
const markReportedMock = jest.mocked(appStorage.setItem);
const getClientMock = jest.mocked(appApiClient.getClient);
const getAttributionTokenMock = jest.fn();
const postMock = jest.fn();

describe('Apple Ads install attribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInstallationTimeMock.mockResolvedValue(new Date());
    getReportedMock.mockResolvedValue(null);
    markReportedMock.mockResolvedValue(undefined);
    getAttributionTokenMock.mockResolvedValue('QXBwbGVBdHRyaWJ1dGlvbkRhdGE=');
    NativeModules.OneKeyAdServicesAttribution = {
      getAttributionToken: getAttributionTokenMock,
    };
    getClientMock.mockResolvedValue({ post: postMock } as never);
    postMock.mockResolvedValue({ data: { code: 0, data: { handled: true } } });
  });

  it('submits the opaque token through the dedicated endpoint and marks success', async () => {
    await reportAppleAdsInstallAttribution(
      'https://utility.onekey.so',
      'installation-123',
    );

    expect(postMock).toHaveBeenCalledWith(
      '/utility/v1/install-attribution/apple-ads',
      { attributionToken: 'QXBwbGVBdHRyaWJ1dGlvbkRhdGE=' },
      { headers: { 'x-onekey-instance-id': 'installation-123' } },
    );
    expect(markReportedMock).toHaveBeenCalledWith(
      'install_attr_apple_ads_v1',
      '1',
    );
  });

  it('does not mark the request handled when delivery fails', async () => {
    postMock.mockRejectedValueOnce(new Error('network failed'));

    await expect(
      reportAppleAdsInstallAttribution(
        'https://utility.onekey.so',
        'installation-123',
      ),
    ).rejects.toThrow('network failed');

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

  it('does not mark an unavailable native module as handled', async () => {
    NativeModules.OneKeyAdServicesAttribution = undefined;

    await expect(
      reportAppleAdsInstallAttribution(
        'https://utility.onekey.so',
        'installation-123',
      ),
    ).rejects.toThrow('native module is unavailable');

    expect(postMock).not.toHaveBeenCalled();
    expect(markReportedMock).not.toHaveBeenCalled();
  });
});
