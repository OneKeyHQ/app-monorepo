import requestHelper from '@onekeyhq/shared/src/request/requestHelper';
import type { IIpTableConfigWithRuntime } from '@onekeyhq/shared/src/request/types/ipTable';

import { updateInterceptorRequestHelper } from './updateInterceptorRequestHelper';

jest.mock('../endpoints', () => ({
  checkIsOneKeyDomain: jest.fn(async () => true),
}));

jest.mock('../states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: {
    get: jest.fn(async () => ({
      enabled: false,
      settings: {},
    })),
  },
}));

jest.mock('../states/jotai/atoms/settings', () => ({
  settingsPersistAtom: {
    get: jest.fn(async () => ({})),
  },
  settingsValuePersistAtom: {
    get: jest.fn(async () => ({})),
  },
}));

function resetIpTableProvider(
  getIpTableConfig: () => Promise<IIpTableConfigWithRuntime | null> = async () =>
    null,
) {
  requestHelper.getIpTableConfig = getIpTableConfig;
}

describe('requestHelper IP Table provider', () => {
  beforeEach(() => {
    resetIpTableProvider();
  });

  it('returns null by default before the full IP Table helper is installed', async () => {
    await jest.isolateModulesAsync(async () => {
      const freshRequestHelper = (
        await import('@onekeyhq/shared/src/request/requestHelper')
      ).default;

      await expect(freshRequestHelper.getIpTableConfig()).resolves.toBeNull();
    });
  });

  it('keeps the full IP Table provider when the base helper is re-applied', async () => {
    const config: IIpTableConfigWithRuntime = {
      config: {
        version: 1,
        ttl_sec: 60,
        generated_at: '2026-06-23T00:00:00.000Z',
        signature: '0x',
        domains: {},
      },
      runtime: {
        enabled: true,
        lastUpdated: 0,
        lastRegionCheck: 0,
        selections: {
          'onekeytest.com': '216.19.2.116',
        },
      },
    };

    resetIpTableProvider(async () => config);

    updateInterceptorRequestHelper();

    await expect(requestHelper.getIpTableConfig()).resolves.toBe(config);
  });
});
