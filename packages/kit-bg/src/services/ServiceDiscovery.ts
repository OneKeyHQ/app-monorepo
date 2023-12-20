import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import type {
  ICategory,
  IDApp,
  IDiscoveryHomePageData,
  IDiscoveryListParams,
} from '@onekeyhq/shared/types/discovery';

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
    return history.slice(start, Math.min(history.length, end));
  }

  private getEndPoint() {
    return 'http://18.138.227.191:9010';
  }

  @backgroundMethod()
  fetchDiscoveryHomePageData() {
    return this._fetchDiscoveryHomePageData();
  }

  _fetchDiscoveryHomePageData = memoizee(
    async () => {
      const client = await this.getClient(this.getEndPoint());
      const res = await client.get<{ data: IDiscoveryHomePageData }>(
        '/api/v2/discover/dapp/homepage',
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
    const client = await this.getClient(this.getEndPoint());
    const {
      data: {
        data: { data: dapps },
      },
    } = await client.get<{ data: { data: IDApp[]; next: string } }>(
      '/api/v2/discover/dapp/search',
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
    const client = await this.getClient(this.getEndPoint());
    const res = await client.get<{ data: ICategory[] }>(
      '/api/v2/discover/category/list',
    );
    return res.data.data;
  }

  @backgroundMethod()
  async fetchDAppListByCategory(listParams: IDiscoveryListParams) {
    const client = await this.getClient(this.getEndPoint());
    const res = await client.get<{
      data: { data: IDApp[]; next: string };
    }>('/api/v2/discover/dapp/list', {
      params: {
        cursor: listParams.cursor,
        limit: listParams.limit ?? 20,
        category: listParams.category,
        network: listParams.network,
      },
    });
    return res.data.data;
  }
}

export default ServiceDiscovery;
