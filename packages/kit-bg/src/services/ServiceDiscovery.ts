import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
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
  async fetchDiscoveryHomePageData() {
    const client = await this.getClient(this.getEndPoint());
    const res = await client.get<{ data: IDiscoveryHomePageData }>(
      '/api/v2/discover/dapp/homepage',
    );
    return res.data.data;
  }

  @backgroundMethod()
  async searchDApp(keyword: string) {
    if (!keyword) {
      return [];
    }
    const client = await this.getClient(this.getEndPoint());
    const res = await client.get<{ data: IDApp[] }>(
      '/api/v2/discover/dapp/search',
      {
        params: {
          keyword,
        },
      },
    );
    return res.data.data;
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
    const res = await client.get<{ data: ICategory[] }>(
      '/api/v2/discover/dapp/list',
      {
        params: {
          cursor: listParams.cursor,
          limit: listParams.limit ?? 20,
          category: listParams.category,
          network: listParams.network,
        },
      },
    );
    return res.data.data;
  }
}

export default ServiceDiscovery;
