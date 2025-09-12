import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { isNil, isNumber } from 'lodash';
import { LRUCache } from 'lru-cache';
import WebViewCleaner from 'react-native-webview-cleaner';

import type {
  IBrowserBookmark,
  IBrowserHistory,
} from '@onekeyhq/kit/src/views/Discovery/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { buildFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IChangeHistoryUpdateItem } from '@onekeyhq/shared/src/types/changeHistory';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import imageUtils from '@onekeyhq/shared/src/utils/imageUtils';
import sortUtils from '@onekeyhq/shared/src/utils/sortUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import {
  EHostSecurityLevel,
  type ICategory,
  type IDApp,
  type IDiscoveryHomePageData,
  type IDiscoveryListParams,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { type IDBCloudSyncItem } from '../dbs/local/types';
import { getEndpoints } from '../endpoints';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceDiscovery extends ServiceBase {
  private signedMessageCache: LRUCache<string, boolean>;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    this.signedMessageCache = new LRUCache<string, boolean>({
      max: 100,
      ttl: timerUtils.getTimeDurationMs({ minute: 60 }),
    });
  }

  @backgroundMethod()
  async fetchHistoryData(page = 1, pageSize = 15) {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const result =
      await this.backgroundApi.simpleDb.browserHistory.getRawData();
    const history = result?.data;
    if (!Array.isArray(history)) {
      return [];
    }
    const data = history.slice(0, Math.min(history.length, end));
    return Promise.all(
      data.map(async (i) => ({
        ...i,
        logo: await this.buildWebsiteIconUrl(i.url),
      })),
    );
  }

  @backgroundMethod()
  fetchDiscoveryHomePageData() {
    return this._fetchDiscoveryHomePageData();
  }

  _fetchDiscoveryHomePageData = memoizee(
    async () => {
      const client = await this.getClient(EServiceEndpointEnum.Utility);
      const res = await client.get<{ data: IDiscoveryHomePageData }>(
        '/utility/v1/discover/dapp/homepage',
      );
      return res.data.data;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 30 }),
    },
  );

  @backgroundMethod()
  async searchDApp(keyword: string) {
    if (!keyword) {
      return [];
    }
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const {
      data: { data: dapps },
    } = await client.get<{ data: IDApp[]; next: string }>(
      '/utility/v1/discover/dapp/search',
      {
        params: {
          keyword,
        },
      },
    );
    return dapps;
  }

  @backgroundMethod()
  async fetchCategoryList() {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const res = await client.get<{ data: ICategory[] }>(
      '/utility/v1/discover/category/list',
    );
    return res.data.data;
  }

  @backgroundMethod()
  async fetchDAppListByCategory(listParams: IDiscoveryListParams) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const res = await client.get<{
      data: { data: IDApp[]; next: string };
    }>('/utility/v1/discover/dapp/list', {
      params: {
        cursor: listParams.cursor,
        limit: listParams.limit ?? 30,
        category: listParams.category,
        network: listParams.network,
      },
    });
    return res.data.data;
  }

  @backgroundMethod()
  async buildWebsiteIconUrl(url: string, size = 128) {
    const hostName = uriUtils.getHostNameFromUrl({ url });
    if (!hostName) return '';

    const endpoints = await getEndpoints();
    return `${endpoints.utility}/utility/v1/discover/icon?hostname=${hostName}&size=${size}`;
  }

  @backgroundMethod()
  async checkUrlSecurity(params: { url: string; from: 'app' | 'script' }) {
    const { url, from } = params;
    const isValidUrl = uriUtils.safeParseURL(url);
    if (!isValidUrl || (await this._isUrlExistInRiskWhiteList(url))) {
      return {
        host: url,
        level: EHostSecurityLevel.Unknown,
        attackTypes: [],
        phishingSite: false,
        alert: '',
        projectName: url,
        checkSources: [],
        createdAt: '',
        dapp: {
          name: '',
          logo: '',
          description: {
            text: '',
          },
          tags: [],
          origins: [],
        },
      } as IHostSecurity;
    }
    try {
      if (from === 'script') {
        return await this._checkUrlSecurityInScript(params);
      }
      return await this._checkUrlSecurity(params);
    } catch (e) {
      return {
        host: url,
        level: EHostSecurityLevel.Medium,
        attackTypes: [],
        phishingSite: false,
        alert: appLocale.intl.formatMessage({
          id: ETranslations.feedback_risk_detection_timed_out,
        }),
        projectName: url,
        checkSources: [],
        createdAt: '',
        dapp: {
          name: '',
          logo: '',
          description: {
            text: '',
          },
          tags: [],
          origins: [],
        },
      } as IHostSecurity;
    }
  }

  _checkUrlSecurity = memoizee(
    async (params: { url: string; from: 'app' | 'script' }) => {
      const client = await this.getClient(EServiceEndpointEnum.Utility);
      const res = await client.get<{ data: IHostSecurity }>(
        '/utility/v1/discover/check-host',
        {
          params: {
            url: params.url,
            from: params.from,
          },
          timeout: 5000,
        },
      );
      return res.data.data;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
    },
  );

  _checkUrlSecurityInScript = memoizee(
    async (params: { url: string; from: 'app' | 'script' }) => {
      const result = await this._checkUrlSecurity(params);
      // Directly accessing the URL might be blocked by browser security policies,
      //  so it needs to be converted to a base64 image
      const baseImages = await Promise.allSettled([
        result?.dapp?.logo
          ? imageUtils.getBase64ImageFromUrl(result.dapp.logo)
          : Promise.resolve(''),
        ...(result?.dapp?.origins?.length
          ? result.dapp.origins.map((origin) =>
              imageUtils.getBase64ImageFromUrl(origin.logo),
            )
          : []),
      ]);

      if (result?.dapp?.logo && baseImages[0].status === 'fulfilled') {
        result.dapp.logo = baseImages[0].value as string;
      }
      if (result?.dapp?.origins?.length && baseImages.length > 1) {
        result.dapp.origins.forEach((origin, index) => {
          const imageResult = baseImages[index + 1];
          if (origin && imageResult && imageResult.status === 'fulfilled') {
            origin.logo = imageResult.value as string;
          }
        });
      }
      return result;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
    },
  );

  @backgroundMethod()
  async getBookmarkData(
    options:
      | {
          generateIcon?: boolean;
          sliceCount?: number;
        }
      | undefined,
  ): Promise<IBrowserBookmark[]> {
    const { generateIcon, sliceCount } = options ?? {};
    const data =
      await this.backgroundApi.simpleDb.browserBookmarks.getRawData();
    let dataSource = data?.data ?? [];
    if (isNumber(sliceCount)) {
      dataSource = dataSource.slice(0, sliceCount);
    }
    const bookmarks = await Promise.all(
      dataSource.map(async (i) => ({
        ...i,
        logo: generateIcon ? await this.buildWebsiteIconUrl(i.url) : undefined,
      })),
    );

    return bookmarks;
  }

  _isUrlExistInRiskWhiteList = memoizee(
    async (url: string) => {
      const data =
        (await this.backgroundApi.simpleDb.browserRiskWhiteList.getRawData()) ??
        {};
      return data[url];
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
    },
  );

  @backgroundMethod()
  async addBrowserUrlToRiskWhiteList(url: string) {
    if (await this._isUrlExistInRiskWhiteList(url)) {
      return;
    }
    const data =
      (await this.backgroundApi.simpleDb.browserRiskWhiteList.getRawData()) ??
      {};
    data[url] = true;
    await this.backgroundApi.simpleDb.browserRiskWhiteList.setRawData(data);
    await this._isUrlExistInRiskWhiteList.delete(url);
  }

  @backgroundMethod()
  async getHistoryData(
    options:
      | {
          generateIcon?: boolean;
          sliceCount?: number;
          keyword?: string;
        }
      | undefined,
  ): Promise<IBrowserHistory[]> {
    const { generateIcon, sliceCount, keyword } = options ?? {};
    const data = await this.backgroundApi.simpleDb.browserHistory.getRawData();
    let dataSource: IBrowserHistory[] = data?.data ?? [];
    if (keyword) {
      const fuse = buildFuse(dataSource, { keys: ['title', 'url'] });
      dataSource = fuse.search(options?.keyword ?? 'uniswap').map((i) => ({
        ...i.item,
        titleMatch: i.matches?.find((v) => v.key === 'title'),
        urlMatch: i.matches?.find((v) => v.key === 'url'),
      }));
    }
    if (isNumber(sliceCount)) {
      dataSource = dataSource.slice(0, sliceCount);
    }
    const histories = await Promise.all(
      dataSource.map(async (i) => ({
        ...i,
        logo: generateIcon ? await this.buildWebsiteIconUrl(i.url) : undefined,
      })),
    );

    return histories;
  }

  @backgroundMethod()
  async clearDiscoveryPageData() {
    const { simpleDb } = this.backgroundApi;
    await Promise.all([
      simpleDb.browserTabs.clearRawData(),
      simpleDb.browserBookmarks.clearRawData(),
      simpleDb.browserHistory.clearRawData(),
      simpleDb.dappConnection.clearRawData(),
      simpleDb.browserRiskWhiteList.clearRawData(),
      this._isUrlExistInRiskWhiteList.clear(),
    ]);
  }

  @backgroundMethod()
  async clearCache() {
    if (platformEnv.isNative) {
      WebViewCleaner.clearAll();
    } else if (platformEnv.isDesktop) {
      void globalThis.desktopApiProxy?.webview.clearWebViewCache();
    }
  }

  @backgroundMethod()
  async setBrowserBookmarks({
    bookmarks,
    isRemove,
    skipSaveLocalSyncItem,
    skipEventEmit,
  }: {
    bookmarks: IBrowserBookmark[];
    isRemove?: boolean;
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    console.log('setBrowserBookmarks', bookmarks);
    // debugger;
    // Get current bookmarks to compare for changes
    const currentData =
      await this.backgroundApi.simpleDb.browserBookmarks.getRawData();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, no-param-reassign
    bookmarks = sortUtils.fillingSaveItemsSortIndex({
      oldList: currentData?.data ?? [],
      saveItems: bookmarks,
    });

    const syncManagers = this.backgroundApi.servicePrimeCloudSync.syncManagers;
    let syncItems: IDBCloudSyncItem[] = [];
    if (!skipSaveLocalSyncItem) {
      const now = await this.backgroundApi.servicePrimeCloudSync.timeNow();
      syncItems = (
        await Promise.all(
          bookmarks.map(async (bookmark) => {
            return syncManagers.browserBookmark.buildSyncItemByDBQuery({
              syncCredential:
                await syncManagers.browserBookmark.getSyncCredential(),
              dbRecord: bookmark,
              dataTime: now,
              isDeleted: isRemove,
            });
          }),
        )
      ).filter(Boolean);
    }

    let savedSuccess = false;

    await this.backgroundApi.localDb.addAndUpdateSyncItems({
      items: syncItems,
      fn: async () => {
        if (isRemove) {
          await this.backgroundApi.simpleDb.browserBookmarks.removeBookmarks({
            urls: bookmarks.map((i) => i.url),
          });
        } else {
          // Save the updated bookmarks
          await this.backgroundApi.simpleDb.browserBookmarks.saveBookmarks({
            bookmarks,
          });
        }

        savedSuccess = true;
      },
    });

    if (!skipEventEmit) {
      setTimeout(() => {
        // Trigger bookmark list refresh after building bookmark data
        appEventBus.emit(EAppEventBusNames.RefreshBookmarkList, undefined);
      }, 200);
    }

    if (savedSuccess && !isRemove) {
      const currentBookmarks = currentData?.data || [];
      const currentBookmarksMap = new Map(
        currentBookmarks.map((i) => [i.url, i]),
      );

      const changeHistoryUpdateItems: IChangeHistoryUpdateItem[] = [];
      // Check for title changes and record history
      for (const newBookmark of bookmarks) {
        const oldBookmark = currentBookmarksMap.get(newBookmark.url);
        if (oldBookmark && oldBookmark.title !== newBookmark.title) {
          // Generate a stable ID based on URL for the bookmark
          const bookmarkId = newBookmark.url;

          changeHistoryUpdateItems.push({
            entityType: EChangeHistoryEntityType.BrowserBookmark,
            entityId: bookmarkId,
            contentType: EChangeHistoryContentType.Name,
            oldValue: oldBookmark.title,
            value: newBookmark.title,
          });
        }
      }

      // Record history for title change
      await this.backgroundApi.simpleDb.changeHistory.addChangeHistory({
        items: changeHistoryUpdateItems,
      });
    }
  }

  @backgroundMethod()
  async getBrowserBookmarks() {
    const data =
      await this.backgroundApi.simpleDb.browserBookmarks.getRawData();
    return data?.data ?? [];
  }

  async getBrowserBookmarksWithFillingSortIndex() {
    const data = await this.getBrowserBookmarks();
    const hasMissingSortIndex = data.some((item) => isNil(item.sortIndex));
    if (hasMissingSortIndex) {
      const newList = sortUtils.fillingMissingSortIndex({ items: data });
      await this.backgroundApi.simpleDb.browserBookmarks.saveBookmarks({
        bookmarks: newList.items,
      });
    }
    return this.getBrowserBookmarks();
  }

  @backgroundMethod()
  async postSignTypedDataMessage(params: {
    networkId: string;
    accountId: string;
    origin: string;
    typedData: string;
  }) {
    const { networkId, accountId, origin, typedData } = params;

    const cacheKey = bytesToHex(
      sha256(`${networkId}__${accountId}__${origin}__${typedData}`),
    );

    if (this.signedMessageCache.has(cacheKey)) {
      return;
    }

    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    try {
      await client.post('/wallet/v1/network/sign-typed-data', {
        accountAddress,
        networkId,
        data: JSON.parse(typedData),
        origin,
      });
      this.signedMessageCache.set(cacheKey, true);
    } catch {
      // ignore error
    }
  }
}

export default ServiceDiscovery;
