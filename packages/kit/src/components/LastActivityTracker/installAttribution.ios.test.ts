import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { reportInstallAttribution } from './installAttribution.ios';

const mockReportAppleAdsInstallAttribution = jest.fn();

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeIOSStore: true,
    isNativeMainThread: true,
    isE2E: false,
  },
}));

jest.mock('@onekeyhq/shared/src/modules/InstallAttribution/appleAds', () => ({
  reportAppleAdsInstallAttribution: mockReportAppleAdsInstallAttribution,
}));

describe('iOS install attribution runtime guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(platformEnv, {
      isNativeIOSStore: true,
      isNativeMainThread: true,
      isE2E: false,
    });
  });

  it('reports only from the iOS App Store main runtime', async () => {
    await reportInstallAttribution(
      'https://utility.onekey.so',
      'installation-123',
    );

    expect(mockReportAppleAdsInstallAttribution).toHaveBeenCalledWith(
      'https://utility.onekey.so',
      'installation-123',
    );
  });

  it.each([
    { isNativeIOSStore: false },
    { isNativeMainThread: false },
    { isE2E: true },
  ])('skips an unsupported runtime: %o', async (environment) => {
    Object.assign(platformEnv, environment);

    await reportInstallAttribution(
      'https://utility.onekey.so',
      'installation-123',
    );

    expect(mockReportAppleAdsInstallAttribution).not.toHaveBeenCalled();
  });
});
