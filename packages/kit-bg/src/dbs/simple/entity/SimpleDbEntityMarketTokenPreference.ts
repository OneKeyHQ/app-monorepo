import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IMarketTokenPreferenceItem {
  contractAddress: string;
  symbol: string;
  networkId: string;
}

export interface IMarketTokenPreferenceDb {
  // key: networkId of the market token being viewed
  preferences: Record<string, IMarketTokenPreferenceItem>;
}

export class SimpleDbEntityMarketTokenPreference extends SimpleDbEntityBase<IMarketTokenPreferenceDb> {
  entityName = 'marketTokenPreference';

  override enableCache = false;

  @backgroundMethod()
  async getPreference({ networkId }: { networkId: string }) {
    const rawData = await this.getRawData();
    return rawData?.preferences?.[networkId];
  }

  @backgroundMethod()
  async setPreference({
    networkId,
    preference,
  }: {
    networkId: string;
    preference: IMarketTokenPreferenceItem;
  }) {
    await this.setRawData((rawData) => ({
      preferences: {
        ...rawData?.preferences,
        [networkId]: preference,
      },
    }));
  }
}
