/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('react-native-webview-cleaner', () => ({
  __esModule: true,
  default: {
    clearAll: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/utils/imageUtils', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  prefixOf: jest.fn((namespace: string) => `${namespace}:`),
  swrCacheNamespaces: {
    discoveryHomeBookmarks: 'disHomeBookmarks',
  },
  swrCacheUtils: {
    removeByPrefix: jest.fn(),
    flushNow: jest.fn(),
  },
}));

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  swrCacheNamespaces,
  swrCacheUtils,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';

import ServiceDiscovery from './ServiceDiscovery';

describe('ServiceDiscovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('drops stored bookmark logos when icons are disabled', async () => {
    const buildWebsiteIconUrl = jest.fn();
    const service = {
      backgroundApi: {
        simpleDb: {
          browserBookmarks: {
            getRawData: jest.fn().mockResolvedValue({
              data: [
                {
                  title: 'OneKey',
                  url: 'https://onekey.so',
                  logo: 'data:image/png;base64,abc',
                  sortIndex: 0,
                },
              ],
            }),
          },
        },
      },
      buildWebsiteIconUrl,
    } as unknown as ServiceDiscovery;

    const result = await ServiceDiscovery.prototype.getBookmarkData.call(
      service,
      {
        generateIcon: false,
      },
    );

    expect(result).toEqual([
      {
        title: 'OneKey',
        url: 'https://onekey.so',
        logo: undefined,
        sortIndex: 0,
      },
    ]);
    expect(buildWebsiteIconUrl).not.toHaveBeenCalled();
  });

  it('invalidates cached discovery home bookmarks after bookmark writes', async () => {
    const emitSpy = jest.spyOn(appEventBus, 'emit');
    const addAndUpdateSyncItems = jest.fn(
      async ({ fn }: { fn: () => Promise<void> }) => {
        await fn();
      },
    );
    const saveBookmarks = jest.fn().mockResolvedValue(undefined);
    const addChangeHistory = jest.fn().mockResolvedValue(undefined);
    const service = Object.assign(Object.create(ServiceDiscovery.prototype), {
      backgroundApi: {
        localDb: {
          addAndUpdateSyncItems,
        },
        servicePrimeCloudSync: {
          syncManagers: {},
        },
        simpleDb: {
          browserBookmarks: {
            getRawData: jest.fn().mockResolvedValue({ data: [] }),
            saveBookmarks,
          },
          changeHistory: {
            addChangeHistory,
          },
        },
      },
    }) as ServiceDiscovery;

    await ServiceDiscovery.prototype.setBrowserBookmarks.call(service, {
      bookmarks: [
        {
          title: 'OneKey',
          url: 'https://onekey.so',
          logo: undefined,
          sortIndex: undefined,
        },
      ],
      skipSaveLocalSyncItem: true,
      skipEventEmit: true,
    });

    expect(saveBookmarks).toHaveBeenCalledTimes(1);
    expect(addAndUpdateSyncItems).toHaveBeenCalledWith(
      expect.objectContaining({ items: [] }),
    );
    expect(swrCacheUtils.removeByPrefix).toHaveBeenCalledWith(
      `${swrCacheNamespaces.discoveryHomeBookmarks}:`,
    );
    expect(swrCacheUtils.flushNow).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(
      EAppEventBusNames.InvalidateDiscoveryHomeBookmarksPrefetch,
      undefined,
    );
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.RefreshBookmarkList,
      undefined,
    );
  });

  it('invalidates cached discovery home bookmarks after clearing discovery data', async () => {
    const emitSpy = jest.spyOn(appEventBus, 'emit');
    const clearRawData = jest.fn().mockResolvedValue(undefined);
    const service = Object.assign(Object.create(ServiceDiscovery.prototype), {
      backgroundApi: {
        simpleDb: {
          browserTabs: {
            clearRawData,
          },
          browserBookmarks: {
            clearRawData,
          },
          browserHistory: {
            clearRawData,
          },
          dappConnection: {
            clearRawData,
          },
          browserRiskWhiteList: {
            clearRawData,
          },
        },
      },
      _isUrlExistInRiskWhiteList: {
        clear: jest.fn(),
      },
    }) as ServiceDiscovery;

    await ServiceDiscovery.prototype.clearDiscoveryPageData.call(service);

    expect(clearRawData).toHaveBeenCalledTimes(5);
    expect(swrCacheUtils.removeByPrefix).toHaveBeenCalledWith(
      `${swrCacheNamespaces.discoveryHomeBookmarks}:`,
    );
    expect(swrCacheUtils.flushNow).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(
      EAppEventBusNames.RefreshBookmarkList,
      undefined,
    );
  });
});
