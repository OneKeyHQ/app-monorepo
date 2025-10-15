import type {
  IBtcFreshAddress,
  IBtcFreshAddressStructure,
} from '@onekeyhq/core/src/chains/btc/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IBTCFreshAddressDb {
  data: Record<string, IBtcFreshAddressStructure>; // key: networkId-xpubSegwit
}

export type IBtcFreshAddressWithRelPath = IBtcFreshAddress & {
  relPath: string;
};

export type IBtcFreshAddressMap = Record<string, IBtcFreshAddressWithRelPath>;

export class SimpleDbEntityBTCFreshAddress extends SimpleDbEntityBase<IBTCFreshAddressDb> {
  entityName = 'btcFreshAddress';

  override enableCache = false;

  async getBTCFreshAddresses({
    networkId,
    xpubSegwit,
  }: {
    networkId: string;
    xpubSegwit: string;
  }) {
    const key = accountUtils.getBTCFreshAddressKey({ networkId, xpubSegwit });
    const data = await this.getRawData();
    return data?.data[key];
  }

  async getBTCFreshAddressMap({
    networkId,
    xpubSegwit,
  }: {
    networkId: string;
    xpubSegwit: string;
  }): Promise<IBtcFreshAddressMap> {
    const btcFreshAddresses = await this.getBTCFreshAddresses({
      networkId,
      xpubSegwit,
    });
    if (!btcFreshAddresses) {
      return {};
    }

    const result: IBtcFreshAddressMap = {};

    const appendAddress = (item: IBtcFreshAddress) => {
      const pathSegments = item.path.split('/').filter(Boolean);
      const relPath = `${pathSegments[4]}/${pathSegments[5]}`;
      result[item.name] = {
        ...item,
        relPath,
      };
    };

    [
      btcFreshAddresses.change?.used,
      btcFreshAddresses.change?.unused,
      btcFreshAddresses.fresh?.used,
      btcFreshAddresses.fresh?.unused,
    ].forEach((group) => {
      group?.forEach(appendAddress);
    });

    return result;
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
      const key = accountUtils.getBTCFreshAddressKey({ networkId, xpubSegwit });
      oldData.data[key] = value;
      return oldData;
    });
  }
}
