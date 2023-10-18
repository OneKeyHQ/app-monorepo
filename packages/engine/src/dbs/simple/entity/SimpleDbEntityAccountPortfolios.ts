import { pick } from 'lodash';

import type {
  EOverviewScanTaskType,
  OverviewAllNetworksPortfolioRes,
} from '@onekeyhq/kit/src/views/Overview/types';

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
    scanTypes,
  }: {
    key: string;
    data: OverviewAllNetworksPortfolioRes;
    scanTypes: EOverviewScanTaskType[];
  }) {
    const res = await this.getData();

    return this.setRawData({
      ...res,
      portfolios: {
        ...(res.portfolios ?? {}),
        [key]: {
          ...res.portfolios?.[key],
          ...pick(data, ...scanTypes),
        },
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

  async removeWalletData(walletIds: string[]) {
    const { portfolios } = await this.getData();
    for (const key of Object.keys(portfolios)) {
      const [, accountId] = key.split('___');
      for (const walletId of walletIds) {
        if (accountId && accountId.startsWith(walletId)) {
          delete portfolios[key];
        }
      }
    }
    return this.setRawData({
      portfolios,
    });
  }
}
