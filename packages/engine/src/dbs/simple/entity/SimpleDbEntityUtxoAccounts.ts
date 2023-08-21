import { SimpleDbEntityBase } from './SimpleDbEntityBase';

import type {
  CoinControlItem,
  CoinControlOption,
} from '../../../types/utxoAccounts';
import type { IBtcUTXO } from '../../../vaults/utils/btcForkChain/types';

export type ISimpleDbEntityUtxoData = {
  utxos: CoinControlItem[];
  lndAccessTokenMap?: Record<string, string>;
  lndRefreshTokenMap?: Record<string, string>;
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
        recycle: !!option.recycle,
        key: getUtxoUniqueKey(utxo),
      },
    ];
    return this.setRawData({ ...rawData, utxos: newItems });
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
          recycle: option.recycle ?? item.recycle,
        };
      }
      return item;
    });
    return this.setRawData({ ...rawData, utxos: newItems });
  }

  // delete
  async deleteCoinControlItem(ids: string[]) {
    const rawData = await this.getRawData();
    const items = rawData?.utxos ?? [];
    const newItems = items.filter((item) => !ids.includes(item.id));
    return this.setRawData({ ...rawData, utxos: newItems });
  }

  async insertRestoreData(data: CoinControlItem[]) {
    const rawData = await this.getRawData();
    const newItems = data.reduce((acc, item) => {
      const existItem = rawData?.utxos?.find((i) => i.id === item.id);
      if (existItem) {
        return [
          ...acc,
          {
            ...existItem,
            ...item,
          },
        ];
      }
      return [...acc, { ...item }];
    }, rawData?.utxos ?? []);

    const newItemsMap = newItems.reduce<Record<string, CoinControlItem>>(
      (acc, item) => ({
        ...acc,
        [item.id]: item,
      }),
      {},
    );
    const newItemsUnique = Object.values(newItemsMap);

    return this.setRawData({ ...rawData, utxos: newItemsUnique });
  }

  async updateLndToken(
    address: string,
    lndAccessToken: string,
    lndRefreshToken: string,
  ) {
    const rawData = await this.getRawData();
    return this.setRawData({
      ...rawData,
      utxos: rawData?.utxos ?? [],
      lndAccessTokenMap: {
        ...(rawData?.lndAccessTokenMap ?? {}),
        [address]: lndAccessToken,
      },
      lndRefreshTokenMap: {
        ...(rawData?.lndRefreshTokenMap ?? {}),
        [address]: lndRefreshToken,
      },
    });
  }

  async getLndAccessToken(address: string) {
    const rawData = await this.getRawData();
    return rawData?.lndAccessTokenMap?.[address];
  }

  async getLndRefreshToken(address: string) {
    const rawData = await this.getRawData();
    return rawData?.lndRefreshTokenMap?.[address];
  }
}

export { SimpleDbEntityUtxoAccounts };
