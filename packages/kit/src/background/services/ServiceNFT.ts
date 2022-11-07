import axios from 'axios';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import {
  getAsset,
  getNFTSymbolPrice,
  getUserNFTAssets,
} from '@onekeyhq/engine/src/managers/nft';
import { OnekeyNetwork } from '@onekeyhq/engine/src/presets/networkIds';
import {
  Collection,
  NFTAsset,
  NFTMarketCapCollection,
  NFTMarketRanking,
  NFTServiceResp,
  NFTTransaction,
} from '@onekeyhq/engine/src/types/nft';

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
  get client() {
    return axios.create({ timeout: 60 * 1000 });
  }

  get baseUrl() {
    return `${getFiatEndpoint()}/NFT`;
  }

  @backgroundMethod()
  async getCollection({
    chain,
    contractAddress,
    showStatistics = false,
  }: {
    chain: string;
    contractAddress: string;
    showStatistics?: boolean;
  }) {
    const url = `${
      this.baseUrl
    }/collection?chain=${chain}&contractAddress=${contractAddress}&showStatistics=${
      showStatistics === true ? 'true' : 'false'
    }`;

    const { data, success } = await this.client
      .get<NFTServiceResp<Collection>>(url)
      .then((resp) => resp.data)
      .catch(() => ({ success: false, data: {} as Collection }));
    if (!success) {
      return undefined;
    }
    return data;
  }

  @backgroundMethod()
  async searchCollections({ chain, name }: { chain: string; name: string }) {
    const url = `${this.baseUrl}/collection/search?chain=${chain}&name=${name}`;
    const { data, success } = await this.client
      .get<NFTServiceResp<Collection[]>>(url)
      .then((resp) => resp.data)
      .catch(() => ({ success: false, data: [] as Collection[] }));
    if (!success) {
      return undefined;
    }
    return data;
  }

  @backgroundMethod()
  async getCollectionAssets({
    chain,
    contractAddress,
    cursor,
    limit = 50,
  }: {
    chain: string;
    contractAddress: string;
    cursor?: string;
    limit?: number;
  }) {
    let url = `${this.baseUrl}/collection/assets?chain=${chain}&contractAddress=${contractAddress}&limit=${limit}`;
    if (cursor) {
      url += `&cursor=${cursor}`;
    }
    const { data, success } = await this.client
      .get<
        NFTServiceResp<{ total: number; next: string; content: NFTAsset[] }>
      >(url)
      .then((resp) => resp.data)
      .catch(() => ({
        success: false,
        data: { total: 0, next: undefined, content: [] as NFTAsset[] },
      }));
    if (!success) {
      return undefined;
    }
    return data;
  }

  @backgroundMethod()
  async getCollectionTransactions({
    chain,
    contractAddress,
    cursor,
    limit = 50,
    eventTypes,
    showAsset,
  }: {
    chain: string;
    contractAddress: string;
    cursor?: string;
    eventTypes?: string;
    limit?: number;
    showAsset?: boolean;
  }) {
    let url = `${this.baseUrl}/collection/transactions?chain=${chain}&contractAddress=${contractAddress}&limit=${limit}`;
    if (eventTypes) {
      url += `&event_type=${eventTypes}`;
    }
    if (showAsset === true) {
      url += `&show_asset=true`;
    }
    if (cursor) {
      url += `&cursor=${cursor}`;
    }
    const { data, success } = await this.client
      .get<
        NFTServiceResp<{
          total: number;
          next: string;
          content: NFTTransaction[];
        }>
      >(url)
      .then((resp) => resp.data)
      .catch(() => ({
        success: false,
        data: { total: 0, next: undefined, content: [] as NFTTransaction[] },
      }));
    if (!success) {
      return undefined;
    }
    return data;
  }

  @backgroundMethod()
  async getMarketCapCollection({
    chain,
    limit,
  }: {
    chain?: string;
    limit?: number;
  }) {
    let url = `${this.baseUrl}/market/marketCap?chain=${
      chain ?? OnekeyNetwork.eth
    }`;
    if (limit) {
      url += `&limit=${limit}`;
    }
    const { data, success } = await this.client
      .get<NFTServiceResp<NFTMarketCapCollection[]>>(url)
      .then((resp) => resp.data)
      .catch(() => ({ success: false, data: [] as NFTMarketCapCollection[] }));
    if (!success) {
      return [];
    }
    return data;
  }

  @backgroundMethod()
  async getMarketRanking({ chain, time }: { chain?: string; time?: string }) {
    const url = `${this.baseUrl}/market/ranking?chain=${
      chain ?? OnekeyNetwork.eth
    }&time=${time ?? '1d'}`;
    const { data, success } = await this.client
      .get<NFTServiceResp<NFTMarketRanking[]>>(url)
      .then((resp) => resp.data)
      .catch(() => ({ success: false, data: [] as NFTMarketRanking[] }));
    if (!success) {
      return [];
    }
    return data;
  }

  @backgroundMethod()
  async getMarketCollection() {
    const url = `${this.baseUrl}/market/collection`;
    const { data, success } = await this.client
      .get<NFTServiceResp<Collection[]>>(url)
      .then((resp) => resp.data)
      .catch(() => ({ success: false, data: [] as Collection[] }));
    if (!success) {
      return [];
    }
    return data;
  }

  @backgroundMethod()
  async getLiveMinting({ chain, limit }: { chain?: string; limit?: number }) {
    const url = `${this.baseUrl}/market/liveMint?chain=${
      chain ?? OnekeyNetwork.eth
    }&limit=${limit ?? 5}`;
    const { data, success } = await this.client
      .get<NFTServiceResp<NFTAsset[]>>(url)
      .then((resp) => resp.data)
      .catch(() => ({ success: false, data: [] as NFTAsset[] }));
    if (!success) {
      return [];
    }
    return data;
  }

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
    if (!items) {
      return;
    }
    const key = getNFTListKey(accountId, networkId);
    return simpleDb.nft.setNFTs(items, key);
  }

  @backgroundMethod()
  async batchLocalCollection({
    networkId,
    accountId,
    contractAddressList,
  }: {
    networkId: string;
    accountId: string;
    contractAddressList: string[]; // sol:use contractName
  }) {
    const collections = await this.getLocalNFTs({ networkId, accountId });
    const collectionMap: Record<string, Collection> = {};
    contractAddressList.forEach((address) => {
      const collection = collections.find((item) => {
        if (networkId === OnekeyNetwork.sol) {
          return item.contractName === address;
        }
        return item.contractAddress && item.contractAddress === address;
      });
      if (collection) {
        collectionMap[address] = collection;
      }
    });
    return collectionMap;
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
  async getAsset(params: {
    accountId?: string;
    networkId: string;
    contractAddress?: string;
    tokenId: string;
    local: boolean;
  }) {
    const { local } = params;
    const localAsset = await this.getAssetFromLocal(params);
    if (localAsset && local) {
      return localAsset;
    }
    const resp = await getAsset(params);
    if (resp) {
      return resp.data;
    }
  }

  @backgroundMethod()
  async getAssetFromLocal({
    accountId,
    networkId,
    contractAddress,
    tokenId,
  }: {
    accountId?: string;
    networkId: string;
    contractAddress?: string;
    tokenId: string;
  }) {
    if (!accountId) {
      return;
    }
    const collections = await this.getLocalNFTs({ networkId, accountId });
    const collection = collections.find(
      (item) => item.contractAddress === contractAddress,
    );
    return collection?.assets.find((item) => item.tokenId === tokenId);
  }

  @backgroundMethod()
  async fetchSymbolPrice(networkId: string) {
    const priceStr = await getNFTSymbolPrice(networkId);
    if (priceStr) {
      const price = parseFloat(priceStr);
      const { dispatch } = this.backgroundApi;
      dispatch(
        setNFTSymbolPrice({
          networkId,
          price,
        }),
      );
      return price;
    }
  }

  @backgroundMethod()
  updatePriceType(priceType: 'floorPrice' | 'lastSalePrice') {
    const { dispatch } = this.backgroundApi;
    dispatch(setNFTPriceType(priceType));
  }
}

export default ServiceNFT;
