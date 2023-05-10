import { SimpleDbEntityBase } from './SimpleDbEntityBase';

import type {
  CoinControlItem,
  CoinControlOption,
} from '../../../types/utxoAccounts';
import type { IBtcUTXO } from '../../../vaults/utils/btcForkChain/types';

export type ISimpleDbEntityUtxoData = {
  utxos: CoinControlItem[];
};

export const getUtxoUniqueKey = (utxo: IBtcUTXO) => `${utxo.txid}_${utxo.vout}`;
export const getUtxoId = (networkId: string, utxo: IBtcUTXO) =>
  `${networkId}_${getUtxoUniqueKey(utxo)}`;

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
        id: getUtxoId(networkId, utxo),
        networkId,
        xpub,
        label: option.label,
        frozen: !!option.frozen,
        key: getUtxoUniqueKey(utxo),
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

  async insertRestoreData(item: CoinControlItem) {
    const rawData = await this.getRawData();
    if (rawData?.utxos?.find((i) => i.id === item.id)) {
      const newItems = rawData?.utxos.map((i) => {
        if (i.id === item.id) {
          return {
            ...i,
            ...item,
          };
        }
        return i;
      });
      return this.setRawData({ utxos: newItems });
    }
    const newItems = [...(rawData?.utxos ?? []), { ...item }];
    return this.setRawData({ utxos: newItems });
  }
}

export { SimpleDbEntityUtxoAccounts };
