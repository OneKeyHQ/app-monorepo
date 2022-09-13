import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import {
  getNFTSymbolPrice,
  getUserNFTAssets,
} from '@onekeyhq/engine/src/managers/nft';
import { Collection } from '@onekeyhq/engine/src/types/nft';

import {
  setNFTPrice,
  setNFTPriceType,
  setNFTSymbolPrice,
} from '../../store/reducers/nft';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

function getNFTListKey(accountId: string, networkId: string) {
  return `${accountId.toLowerCase()}-${networkId}`.toLowerCase();
}

@backgroundClass()
class ServiceNFT extends ServiceBase {
  @backgroundMethod()
  async saveNFTs({
    networkId,
    accountId,
    items,
  }: {
    networkId: string;
    accountId: string;
    items: Collection[];
  }) {
    if (!items || !items.length) {
      return;
    }
    const key = getNFTListKey(accountId, networkId);
    return simpleDb.nft.setNFTs(items, key);
  }

  @backgroundMethod()
  async getLocalNFTs({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<Collection[]> {
    const key = getNFTListKey(accountId, networkId);
    const items = await simpleDb.nft.getNFTs(key);
    if (items) {
      return items;
    }
    return [];
  }

  @backgroundMethod()
  async fetchNFT({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    const { data } = await getUserNFTAssets({ accountId, networkId });
    const { dispatch } = this.backgroundApi;

    const floorPrice = 0;
    let lastSalePrice = 0;
    const items = data.map((collection) => {
      let totalPrice = 0;
      collection.assets = collection.assets.map((asset) => {
        asset.collection.floorPrice = collection.floorPrice;
        totalPrice += asset.latestTradePrice ?? 0;
        return asset;
      });
      collection.totalPrice = totalPrice;
      lastSalePrice += totalPrice;
      return collection;
    });

    dispatch(
      setNFTPrice({
        networkId,
        accountId,
        price: { 'floorPrice': floorPrice, 'lastSalePrice': lastSalePrice },
      }),
    );
    this.saveNFTs({ networkId, accountId, items });
    return items;
  }

  @backgroundMethod()
  async fetchSymbolPrice(networkId: string) {
    const price = await getNFTSymbolPrice(networkId);
    const { dispatch } = this.backgroundApi;
    dispatch(
      setNFTSymbolPrice({
        networkId,
        price,
      }),
    );
    return price;
  }

  @backgroundMethod()
  updatePriceType(priceType: 'floorPrice' | 'lastSalePrice') {
    const { dispatch } = this.backgroundApi;
    dispatch(setNFTPriceType(priceType));
  }
}

export default ServiceNFT;
