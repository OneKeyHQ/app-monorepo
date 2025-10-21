import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IBtcFreshAddressMetaRecord = {
  lastUpdateTime?: number;
  txCount?: number;
  localUsedAddressesHash?: string;
};

export interface IBtcFreshAddressMetaDb {
  data: Record<string, IBtcFreshAddressMetaRecord>;
}

export class SimpleDbEntityBTCFreshAddressMeta extends SimpleDbEntityBase<IBtcFreshAddressMetaDb> {
  entityName = 'btcFreshAddressMeta';

  override enableCache = false;

  private getKey({
    networkId,
    xpubSegwit,
  }: {
    networkId: string;
    xpubSegwit: string;
  }) {
    return accountUtils.getBTCFreshAddressKey({ networkId, xpubSegwit });
  }

  async getRecord(params: { networkId: string; xpubSegwit: string }) {
    const key = this.getKey(params);
    const raw = await this.getRawData();
    return raw?.data?.[key];
  }

  async updateRecord({
    networkId,
    xpubSegwit,
    patch,
  }: {
    networkId: string;
    xpubSegwit: string;
    patch: IBtcFreshAddressMetaRecord;
  }) {
    await this.setRawData((data) => {
      const next: IBtcFreshAddressMetaDb = data ?? { data: {} };
      const key = this.getKey({ networkId, xpubSegwit });
      next.data[key] = {
        ...(next.data[key] ?? {}),
        ...patch,
      };
      return next;
    });
  }
}
