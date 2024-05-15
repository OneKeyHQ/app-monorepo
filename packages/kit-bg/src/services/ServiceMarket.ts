import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IMarketCategory } from '@onekeyhq/shared/types/market';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceMarket extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async fetchCategories() {
    const client = await this.getClient();
    // const response = await client.get('/api/market/category/list');
    // console.log('---response.data---', response.data);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return require('./serviceMarket.json') as IMarketCategory[];
  }

  @backgroundMethod()
  async fetchCategory(
    category: string,
    coingeckoIds: string[],
    sparkline: boolean,
  ) {
    const client = await this.getClient();
    // const response = await client.get('/utility/v1/market/tokens', {
    //   params: {
    //     category,
    //     ids: encodeURI(coingeckoIds.join(',')),
    //     sparkline,
    //   },
    //   paramsSerializer: (params) => {
    //     const urlSearchParams = new URLSearchParams(params);
    //     return urlSearchParams.toString();
    //   },
    // });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return require('./serviceMarketToken.json') as IMarketCategory[];
  }
}

export default ServiceMarket;
