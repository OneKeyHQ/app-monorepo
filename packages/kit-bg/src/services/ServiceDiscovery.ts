import { isNumber } from 'lodash';

import type {
  IBrowserBookmark,
  IBrowserHistory,
} from '@onekeyhq/kit/src/views/Discovery/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type {
  ICategory,
  IDApp,
  IDiscoveryHomePageData,
  IDiscoveryListParams,
  IHostSecurity,
} from '@onekeyhq/shared/types/discovery';

import { getEndpoints } from '../endpoints';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceDiscovery extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
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
      const client = await this.getClient();
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
    const client = await this.getClient();
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
    const client = await this.getClient();
    const res = await client.get<{ data: ICategory[] }>(
      '/utility/v1/discover/category/list',
    );
    return res.data.data;
  }

  @backgroundMethod()
  async fetchDAppListByCategory(listParams: IDiscoveryListParams) {
    const client = await this.getClient();
    const res = await client.get<{
      data: { data: IDApp[]; next: string };
    }>('/utility/v1/discover/dapp/list', {
      params: {
        cursor: listParams.cursor,
        limit: listParams.limit ?? 20,
        category: listParams.category,
        network: listParams.network,
      },
    });
    return res.data.data;
  }

  @backgroundMethod()
  async buildWebsiteIconUrl(url: string, size = 64) {
    const hostName = uriUtils.getHostNameFromUrl({ url });
    if (!hostName) return '';

    const endpoints = await getEndpoints();
    return `${endpoints.http}/utility/v1/discover/icon?hostname=${hostName}&size=${size}`;
  }

  @backgroundMethod()
  async checkUrlSecurity(url: string) {
    return this._checkUrlSecurity(url);
  }

  _checkUrlSecurity = memoizee(
    async (url: string) => {
      const client = await this.getClient();
      const res = await client.get<{ data: IHostSecurity }>(
        '/utility/v1/discover/check-host',
        {
          params: {
            url,
          },
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

  @backgroundMethod()
  async getHistoryData(
    options:
      | {
          generateIcon?: boolean;
          sliceCount?: number;
        }
      | undefined,
  ): Promise<IBrowserHistory[]> {
    const { generateIcon, sliceCount } = options ?? {};
    const data = await this.backgroundApi.simpleDb.browserHistory.getRawData();
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

  @backgroundMethod()
  async clearDiscoveryPageData() {
    const { simpleDb } = this.backgroundApi;
    await Promise.all([
      simpleDb.browserTabs.clearRawData(),
      simpleDb.browserBookmarks.clearRawData(),
      simpleDb.browserHistory.clearRawData(),
      simpleDb.dappConnection.clearRawData(),
    ]);
  }
}

export default ServiceDiscovery;
