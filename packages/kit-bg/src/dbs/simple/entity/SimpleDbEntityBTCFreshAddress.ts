import type { IBtcFreshAddressStructure } from '@onekeyhq/core/src/chains/btc/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IBTCFreshAddressDb {
  data: Record<string, IBtcFreshAddressStructure>; // key: networkId-xpubSegwit
}

export class SimpleDbEntityBTCFreshAddress extends SimpleDbEntityBase<IBTCFreshAddressDb> {
  entityName = 'btcFreshAddress';

  override enableCache = false;

  private getKey(networkId: string, xpubSegwit: string) {
    return `${networkId}__${xpubSegwit}`;
  }

  async getBTCFreshAddresses({
    networkId,
    xpubSegwit,
  }: {
    networkId: string;
    xpubSegwit: string;
  }) {
    const key = this.getKey(networkId, xpubSegwit);
    const data = await this.getRawData();
    return data?.data[key];
  }

  async updateBTCFreshAddresses({
    networkId,
    xpubSegwit,
    value,
  }: {
    networkId: string;
    xpubSegwit: string;
    value: IBtcFreshAddressStructure;
  }) {
    await this.setRawData((data) => {
      const oldData = data ?? { data: {} };
      const key = this.getKey(networkId, xpubSegwit);
      oldData.data[key] = value;
      return oldData;
    });
  }
}
