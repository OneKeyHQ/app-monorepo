import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { isNumber } from 'lodash';
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { buildFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
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
      maxAge: timerUtils.getTimeDurationMs({ seconds: 5 }),
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
    const { url } = params;
    const isValidUrl = uriUtils.safeParseURL(url);
    if (!isValidUrl || (await this._isUrlExistInRiskWhiteList(url))) {
      return {
        host: url,
        level: EHostSecurityLevel.Unknown,
        attackTypes: [],
        phishingSite: false,
        alert: '',
      } as IHostSecurity;
    }
    try {
      const result = await this._checkUrlSecurity(params);
      return result;
    } catch (e) {
      return {
        host: url,
        level: EHostSecurityLevel.Medium,
        attackTypes: [],
        phishingSite: false,
        alert: appLocale.intl.formatMessage({
          id: ETranslations.feedback_risk_detection_timed_out,
        }),
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
      window.desktopApi.clearWebViewCache();
    }
  }

  @backgroundMethod()
  async setBrowserBookmarks(bookmarks: IBrowserBookmark[]) {
    await this.backgroundApi.simpleDb.browserBookmarks.setRawData({
      data: bookmarks,
    });
  }

  @backgroundMethod()
  async getBrowserBookmarks() {
    const data =
      await this.backgroundApi.simpleDb.browserBookmarks.getRawData();
    return data?.data ?? [];
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
