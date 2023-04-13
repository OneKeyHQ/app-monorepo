import { SimpleDbEntityBase } from './SimpleDbEntityBase';

import type {
  CoinControlItem,
  CoinControlOption,
} from '../../../types/utxoAccounts';
import type { IBtcUTXO } from '../../../vaults/utils/btcForkChain/types';

export type ISimpleDbEntityUtxoData = {
  utxos: CoinControlItem[];
};

class SimpleDbEntityUtxoAccounts extends SimpleDbEntityBase<ISimpleDbEntityUtxoData> {
  entityName = 'utxoAccounts';

  override enableCache = false;

  // insert
  async addCoinControlItem(
    networkId: string,
    utxo: IBtcUTXO,
    xpub: string,
    option: CoinControlOption,
  ) {
    const rawData = await this.getRawData();
    const newItems = [
      ...(rawData?.utxos ?? []),
      {
        id: `${networkId}_${utxo.txid}_${utxo.vout}`,
        networkId,
        xpub,
        label: option.label,
        frozen: !!option.frozen,
        key: `${utxo.txid}_${utxo.vout}`,
      },
    ];
    return this.setRawData({ utxos: newItems });
  }

  // query
  async getCoinControlList(networkId: string, xpub: string) {
    const rawData = await this.getRawData();
    const items = rawData?.utxos ?? [];
    return items.filter(
      (item) => item.networkId === networkId && item.xpub === xpub,
    );
  }

  async getCoinControlById(id: string) {
    const rawData = await this.getRawData();
    const items = rawData?.utxos ?? [];
    return items.find((item) => item.id === id);
  }

  // update
  async updateCoinControlItem(id: string, option: CoinControlOption) {
    const rawData = await this.getRawData();
    const items = rawData?.utxos ?? [];
    const newItems = items.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          label: option.label ?? item.label,
          frozen: option.frozen ?? item.frozen,
        };
      }
      return item;
    });
    return this.setRawData({ utxos: newItems });
  }

  // delete
  async deleteCoinControlItem(ids: string[]) {
    const rawData = await this.getRawData();
    const items = rawData?.utxos ?? [];
    const newItems = items.filter((item) => !ids.includes(item.id));
    return this.setRawData({ utxos: newItems });
  }
}

export { SimpleDbEntityUtxoAccounts };
