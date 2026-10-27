/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import ServiceSetting from './ServiceSetting';

import type { ISimpleDBAggregateToken } from '../dbs/simple/entity/SimpleDbEntityAggregateToken';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: any) => target,
  backgroundMethod: () => (_t: any, _k: string, desc: any) => desc,
  backgroundMethodForDev: () => (_t: any, _k: string, desc: any) => desc,
  toastIfError: () => (_t: any, _k: string, desc: any) => desc,
  checkDevOnlyPassword: jest.fn(),
}));

const currentAppVersion = platformEnv.version ?? '';
const currentBundleVersion = platformEnv.bundleVersion ?? '';
const oneDayMs = timerUtils.getTimeDurationMs({ day: 1 });

function buildService(rawData: ISimpleDBAggregateToken | null) {
  const service = new ServiceSetting({
    backgroundApi: {
      simpleDb: {
        aggregateToken: {
          getRawData: jest.fn(async () => rawData),
        },
      },
    },
  });
  const syncSpy = jest
    .spyOn(service, 'syncWalletConfig')
    .mockResolvedValue({} as any);
  return { service, syncSpy };
}

describe('ServiceSetting.syncWalletConfigIfNeeded', () => {
  it('syncs when the config has never been synced', async () => {
    const { service, syncSpy } = buildService(null);

    await service.syncWalletConfigIfNeeded();

    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  it('syncs when the cached config has no sync meta', async () => {
    const { service, syncSpy } = buildService({
      aggregateTokenConfigMap: {},
    });

    await service.syncWalletConfigIfNeeded();

    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  it('syncs when the app version changed since the last sync', async () => {
    const { service, syncSpy } = buildService({
      aggregateTokenConfigMap: {},
      configSyncMeta: {
        appVersion: 'stale-app-version',
        bundleVersion: currentBundleVersion,
        syncedAt: Date.now(),
      },
    });

    await service.syncWalletConfigIfNeeded();

    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  it('syncs when the cached config is older than the TTL', async () => {
    const { service, syncSpy } = buildService({
      aggregateTokenConfigMap: {},
      configSyncMeta: {
        appVersion: currentAppVersion,
        bundleVersion: currentBundleVersion,
        syncedAt: Date.now() - oneDayMs - 1,
      },
    });

    await service.syncWalletConfigIfNeeded();

    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  it('skips syncing when the cached config is fresh', async () => {
    const { service, syncSpy } = buildService({
      aggregateTokenConfigMap: {},
      configSyncMeta: {
        appVersion: currentAppVersion,
        bundleVersion: currentBundleVersion,
        syncedAt: Date.now(),
      },
    });

    await service.syncWalletConfigIfNeeded();

    expect(syncSpy).not.toHaveBeenCalled();
  });

  it('dedupes concurrent calls into a single sync', async () => {
    const { service, syncSpy } = buildService(null);

    await Promise.all([
      service.syncWalletConfigIfNeeded(),
      service.syncWalletConfigIfNeeded(),
    ]);

    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  it('syncs when the hot-update bundle version changed since the last sync', async () => {
    const { service, syncSpy } = buildService({
      aggregateTokenConfigMap: {},
      configSyncMeta: {
        appVersion: currentAppVersion,
        bundleVersion: 'stale-bundle-version',
        syncedAt: Date.now(),
      },
    });

    await service.syncWalletConfigIfNeeded();

    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  it('treats a cache without bundle version as stale only when the build has one', async () => {
    const originalBundleVersion = platformEnv.bundleVersion;
    try {
      platformEnv.bundleVersion = 'hot-update-1';
      const stale = buildService({
        aggregateTokenConfigMap: {},
        configSyncMeta: {
          appVersion: currentAppVersion,
          syncedAt: Date.now(),
        },
      });
      await stale.service.syncWalletConfigIfNeeded();
      expect(stale.syncSpy).toHaveBeenCalledTimes(1);

      platformEnv.bundleVersion = undefined;
      const fresh = buildService({
        aggregateTokenConfigMap: {},
        configSyncMeta: {
          appVersion: currentAppVersion,
          syncedAt: Date.now(),
        },
      });
      await fresh.service.syncWalletConfigIfNeeded();
      expect(fresh.syncSpy).not.toHaveBeenCalled();
    } finally {
      platformEnv.bundleVersion = originalBundleVersion;
    }
  });
});
