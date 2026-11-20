import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { getPrimeSimulatedPackagesFault } from './primePackagesFetchFault';

const mockGetDevSetting = jest.fn<Promise<unknown>, []>();
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDevSetting: { getDevSetting: () => mockGetDevSetting() },
  },
}));

describe('Prime simulated packages fault', () => {
  it('stays off unless dev settings are enabled', async () => {
    mockGetDevSetting.mockResolvedValue({
      enabled: false,
      settings: { primeFetchPackagesFault: '10' },
    });
    await expect(getPrimeSimulatedPackagesFault()).resolves.toBeUndefined();
    mockGetDevSetting.mockResolvedValue({
      enabled: true,
      settings: { primeFetchPackagesFault: 'off' },
    });
    await expect(getPrimeSimulatedPackagesFault()).resolves.toBeUndefined();
  });

  it.each(['0', '2', '3', '5', '10', '23', '33'])(
    'throws RevenueCat code %s',
    async (code) => {
      mockGetDevSetting.mockResolvedValue({
        enabled: true,
        settings: { primeFetchPackagesFault: code },
      });
      await expect(getPrimeSimulatedPackagesFault()).resolves.toEqual({
        error: expect.objectContaining({ code }),
      });
    },
  );

  it('simulates an empty offering and ignores a failed settings read', async () => {
    mockGetDevSetting.mockResolvedValue({
      enabled: true,
      settings: { primeFetchPackagesFault: 'emptyOffering' },
    });
    await expect(getPrimeSimulatedPackagesFault()).resolves.toEqual({});
    mockGetDevSetting.mockRejectedValue(new OneKeyLocalError('unavailable'));
    await expect(getPrimeSimulatedPackagesFault()).resolves.toBeUndefined();
  });

  it('simulates a mainland China Apple Account', async () => {
    mockGetDevSetting.mockResolvedValue({
      enabled: true,
      settings: { primeFetchPackagesFault: 'chinaStorefront' },
    });
    await expect(getPrimeSimulatedPackagesFault()).resolves.toEqual({
      error: expect.objectContaining({ code: '23' }),
      storefrontCountryCode: 'CHN',
    });
  });
});
