import { groupBy } from 'lodash';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import { OneKeyInternalError } from '@onekeyhq/engine/src/errors';
import * as nft from '@onekeyhq/engine/src/managers/nft';
import { NFTDataType } from '@onekeyhq/engine/src/managers/nft';
import type {
  Collection,
  MarketPlace,
  NFTAssetMeta,
  NFTBTCAssetModel,
  NFTListItems,
  NFTMarketRanking,
  NFTPNL,
  NFTServiceResp,
  NFTTransaction,
} from '@onekeyhq/engine/src/types/nft';
import { setNFTPriceType } from '@onekeyhq/kit/src/store/reducers/nft';
import { EOverviewScanTaskType } from '@onekeyhq/kit/src/views/Overview/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceNFT extends ServiceBase {
  get baseUrl() {
    return `${getFiatEndpoint()}/NFT`;
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
  async batchAsset(params: {
    ignoreError?: boolean;
    chain: string;
    items: { contract_address?: string; token_id?: any }[];
  }) {
    return nft.batchAsset(params);
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
  async fetchNFT({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    const { serviceOverview } = this.backgroundApi;
    await serviceOverview.fetchAccountOverview({
      accountId,
      networkId,
      scanTypes: [EOverviewScanTaskType.nfts],
    });
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
  async getAllAssetsFromLocal(params: {
    accountId?: string;
    networkId: string;
  }) {
    return nft.getAllAssetsFromLocal(params);
  }

  @backgroundMethod()
  updatePriceType(priceType: 'floorPrice' | 'lastSalePrice') {
    const { dispatch } = this.backgroundApi;
    dispatch(setNFTPriceType(priceType));
  }

  @backgroundMethod()
  async getNftListWithAssetType({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<NFTAssetMeta[]> {
    if (!networkId || !accountId) {
      return [];
    }
    const nftPortfolio = await simpleDb.accountPortfolios.getPortfolio({
      networkId,
      accountId,
    });

    const nfts = nftPortfolio?.[EOverviewScanTaskType.nfts] ?? [];

    const { engine } = this.backgroundApi;

    const results = await Promise.all(
      Object.entries(groupBy(nfts, 'networkId')).map(async ([key, list]) => {
        const vault = await engine.getChainOnlyVault(key);
        return vault.getUserNFTAssets({ serviceData: list as NFTListItems });
      }),
    );

    return results.filter(Boolean);
  }

  @backgroundMethod()
  async updateAsset({
    accountId,
    networkId,
    asset,
  }: {
    accountId?: string;
    networkId: string;
    asset: NFTBTCAssetModel;
  }) {
    if (!accountId) return;
    const res = await simpleDb.accountPortfolios.getData();
    const key = `${networkId}___${accountId}`;

    const portfolios = res.portfolios[key];

    const nfts = portfolios?.[EOverviewScanTaskType.nfts] || [];

    const type = NFTDataType(networkId);

    if (type === 'btc') {
      const index = (nfts as NFTBTCAssetModel[]).findIndex(
        (item) => item.inscription_id === asset.inscription_id,
      );
      if (index !== -1) {
        nfts[index] = asset;
        simpleDb.accountPortfolios.setRawData({
          ...res,
          portfolios: {
            ...(res.portfolios ?? {}),
            [key]: {
              ...res.portfolios?.[key],
              [EOverviewScanTaskType.nfts]: nfts,
            },
          },
        });
      }
    }
  }
}

export default ServiceNFT;
