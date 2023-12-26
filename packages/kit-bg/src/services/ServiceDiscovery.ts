import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type {
  ICategory,
  IDApp,
  IDiscoveryHomePageData,
  IDiscoveryListParams,
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
    if (start >= history.length) {
      return [];
    }
    const data = history.slice(start, Math.min(history.length, end));
    return Promise.all(
      data.map(async (i) => ({ ...i, logo: await this.getWebsiteIcon(i.url) })),
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
      maxAge: getTimeDurationMs({ seconds: 5 }),
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
  async getWebsiteIcon(url: string, size = 64) {
    const hostName = uriUtils.getHostNameFromUrl({ url });
    if (!hostName) return '';

    const endpoints = await getEndpoints();
    return `${endpoints.http}/utility/v1/discover/icon?hostname=${hostName}&size=${size}`;
  }
}

export default ServiceDiscovery;
