import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import { OneKeyInternalError } from '@onekeyhq/engine/src/errors';
import * as nft from '@onekeyhq/engine/src/managers/nft';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type {
  Collection,
  CollectionAttribute,
  INFTAsset,
  MarketPlace,
  NFTAsset,
  NFTAssetMeta,
  NFTListItems,
  NFTMarketCapCollection,
  NFTMarketRanking,
  NFTPNL,
  NFTServiceResp,
  NFTTransaction,
} from '@onekeyhq/engine/src/types/nft';
import { NFTAssetType } from '@onekeyhq/engine/src/types/nft';
import {
  setNFTPrice,
  setNFTPriceType,
  setNFTSymbolPrice,
} from '@onekeyhq/kit/src/store/reducers/nft';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import ServiceBase from './ServiceBase';

function getNFTListKey(accountId: string, networkId: string) {
  return `${accountId.toLowerCase()}-${networkId}`.toLowerCase();
}

@backgroundClass()
class ServiceNFT extends ServiceBase {
  get baseUrl() {
    return `${getFiatEndpoint()}/NFT`;
  }

  @backgroundMethod()
  async getUserNFTAssets({
    account,
    networkId,
    ignoreError = true,
  }: {
    account: Account;
    networkId: string;
    ignoreError?: boolean;
  }): Promise<NFTAssetMeta | undefined> {
    const apiUrl = `${this.baseUrl}/v2/list?address=${account.address}&chain=${networkId}`;
    const { data: nfts, success } = await this.client
      .get<NFTServiceResp<NFTListItems>>(apiUrl)
      .then((resp) => resp.data)
      .catch(() => ({ success: false, data: undefined }));

    if (!success || typeof nfts === 'undefined') {
      if (ignoreError) {
        return undefined;
      }
      throw new OneKeyInternalError('data load error');
    }
    const { engine } = this.backgroundApi;
    const vault = await engine.getVault({ networkId, accountId: account.id });
    return vault.getUserNFTAssets({ serviceData: nfts });
  }

  @backgroundMethod()
  async fetchAsset(params: {
    chain: string;
    contractAddress?: string;
    tokenId: string;
    showAttribute?: boolean;
  }) {
    return nft.fetchAsset(params);
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
    const urlParams = new URLSearchParams({ chain, contractAddress });
    if (showStatistics) {
      urlParams.append('showStatistics', 'true');
    }
    const url = `${this.baseUrl}/collection?${urlParams.toString()}`;

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
  async getCollectionAttributes({
    chain,
    contractAddress,
  }: {
    chain: string;
    contractAddress: string;
  }) {
    const urlParams = new URLSearchParams({ chain, contractAddress });
    const url = `${this.baseUrl}/collection/attributes?${urlParams.toString()}`;

    const { data, success } = await this.client
      .get<NFTServiceResp<CollectionAttribute[]>>(url)
      .then((resp) => resp.data)
      .catch(() => ({ success: false, data: [] }));
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
  async getAssetsWithAttributes(params: {
    chain: string;
    contractAddress: string;
    attributes: any[];
    limit?: number;
    cursor?: string;
  }) {
    const apiUrl = `${this.baseUrl}/assets/attributes`;
    const { data, success } = await this.client
      .post<
        NFTServiceResp<{ total: number; next: string; content: NFTAsset[] }>
      >(apiUrl, params)
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
  async batchAsset({
    ignoreError = true,
    ...params
  }: {
    ignoreError?: boolean;
    chain: string;
    items: { contract_address?: string; token_id?: any }[];
  }) {
    const apiUrl = `${this.baseUrl}/batchAsset`;
    const { data, success } = await this.client
      .post<NFTServiceResp<INFTAsset[]>>(apiUrl, params)
      .then((resp) => resp.data)
      .catch(() => ({
        success: false,
        data: [] as INFTAsset[],
      }));

    if (!success) {
      if (ignoreError) {
        return undefined;
      }
      throw new OneKeyInternalError('data load error');
    }
    return data;
  }

  @backgroundMethod()
  async getPNLData({
    address,
    ignoreError = true,
  }: {
    address: string;
    ignoreError?: boolean;
  }) {
    const url = `${this.baseUrl}/account/pnl?&address=${address}`;
    const { data, success } = await this.client
      .get<NFTServiceResp<NFTPNL[]>>(url)
      .then((resp) => resp.data)
      .catch(() => ({ success: false, data: [] as NFTPNL[] }));

    if (!success) {
      if (ignoreError) {
        return [];
      }
      throw new OneKeyInternalError('data load error');
    }
    return data;
  }

  @backgroundMethod()
  async getMarketPlaces(params: { chain?: string }) {
    const { chain } = params;
    let url = `${this.baseUrl}/marketPlace/list`;
    if (chain) {
      url += `?chain=${chain}`;
    }
    const { data, success } = await this.client
      .get<NFTServiceResp<MarketPlace[]>>(url)
      .then((resp) => resp.data)
      .catch(() => ({ success: false, data: [] as MarketPlace[] }));

    if (!success) {
      return [];
    }
    return data;
  }

  @backgroundMethod()
  async saveNFTs({
    networkId,
    address,
    items,
  }: {
    networkId: string;
    address: string;
    items: NFTListItems;
  }) {
    if (!items) {
      return;
    }
    const key = getNFTListKey(address, networkId);
    return simpleDb.nft.setNFTs(items, key);
  }

  @backgroundMethod()
  async getLocalNFTs({
    networkId,
    account,
  }: {
    networkId: string;
    account: Account;
  }): Promise<NFTAssetMeta | undefined> {
    const key = getNFTListKey(account.address, networkId);
    const items = await simpleDb.nft.getNFTs(key);
    if (items) {
      const { engine } = this.backgroundApi;
      const vault = await engine.getVault({ networkId, accountId: account.id });
      return vault.getUserNFTAssets({ serviceData: items });
    }
  }

  @backgroundMethod()
  async fetchNFT({
    account,
    networkId,
    ignoreError = true,
  }: {
    account: Account;
    networkId: string;
    ignoreError?: boolean;
  }): Promise<NFTAssetMeta | undefined> {
    const { dispatch } = this.backgroundApi;

    const serviceData = await this.getUserNFTAssets({
      account,
      networkId,
      ignoreError,
    });

    if (typeof serviceData !== 'undefined') {
      const { data: nfts, type } = serviceData;
      if (type === NFTAssetType.BTC) {
        this.saveNFTs({ networkId, address: account.address, items: nfts });
        return {
          type,
          data: nfts,
        };
      }
      const floorPrice = 0;
      let lastSalePrice = 0;

      const items = nfts.map((collection) => {
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
          accountId: account.address,
          price: { 'floorPrice': floorPrice, 'lastSalePrice': lastSalePrice },
        }),
      );
      return {
        type,
        data: items,
      };
    }
  }

  @backgroundMethod()
  async getAsset(params: {
    accountId?: string;
    networkId: string;
    contractAddress?: string;
    tokenId: string;
    local: boolean;
  }) {
    return nft.getAsset(params);
  }

  @backgroundMethod()
  async getAssetFromLocal(params: {
    accountId?: string;
    networkId: string;
    contractAddress?: string;
    tokenId: string;
  }) {
    return nft.getAssetFromLocal(params);
  }

  @backgroundMethod()
  async fetchSymbolPrice(networkId: string) {
    const price = await nft.getNFTSymbolPrice(networkId);
    if (price) {
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
