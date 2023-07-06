import type { OverviewAllNetworksPortfolioRes } from '@onekeyhq/kit/src/views/Overview/types';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export type ISimpleDbEntityAccountPortfolioData = {
  portfolios: Record<string, OverviewAllNetworksPortfolioRes>;
};

const defaultData = {
  portfolios: {},
};

export class SimpleDbEntityAccountPortfolios extends SimpleDbEntityBase<ISimpleDbEntityAccountPortfolioData> {
  entityName = 'overviewPortfolios';

  override enableCache = true;

  async setAllNetworksPortfolio({
    key,
    data,
  }: {
    key: string;
    data: OverviewAllNetworksPortfolioRes;
  }) {
    const res = await this.getData();

    return this.setRawData({
      ...res,
      portfolios: {
        ...(res.portfolios ?? {}),
        [key]: data,
      },
    });
  }

  async getData(): Promise<ISimpleDbEntityAccountPortfolioData> {
    return (await this.getRawData()) || defaultData;
  }

  async getPortfolio({
    networkId,
    accountId,
  }: {
    networkId?: string;
    accountId?: string;
  }): Promise<OverviewAllNetworksPortfolioRes> {
    const data = await this.getData();
    if (!networkId || !accountId) {
      return {} as OverviewAllNetworksPortfolioRes;
    }
    return data.portfolios[`${networkId}___${accountId}`] ?? {};
  }

  async clear() {
    return this.setRawData(defaultData);
  }
}
