import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import type {
  IAccountNFT,
  IFetchAccountNFTsParams,
  IFetchAccountNFTsResp,
  IFetchNFTDetailsParams,
  IFetchNFTDetailsResp,
} from '@onekeyhq/shared/types/nft';

import simpleDb from '../dbs/simple/simpleDb';
import { getVaultSettings } from '../vaults/settings';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceNFT extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async fetchAccountNFTs(params: IFetchAccountNFTsParams) {
    const client = await this.getClient();
    const resp = await client.get<{
      data: IFetchAccountNFTsResp;
    }>('/wallet/v1/account/nft/list', {
      params,
    });
    return resp.data.data;
  }

  @backgroundMethod()
  public async fetchNFTDetails(params: IFetchNFTDetailsParams) {
    const client = await this.getClient();
    const resp = await client.get<IFetchNFTDetailsResp>(
      '/wallet/v1/account/nft/detail',
      {
        params,
      },
    );
    return resp.data.data;
  }

  @backgroundMethod()
  public async getIsNetworkNFTEnabled({ networkId }: { networkId: string }) {
    const settings = await getVaultSettings({ networkId });
    return settings.NFTEnabled;
  }

  @backgroundMethod()
  public async updateLocalNFTs({
    networkId,
    nfts,
  }: {
    networkId: string;
    nfts: IAccountNFT[];
  }) {
    const nftMap = {} as Record<string, IAccountNFT>;
    nfts.forEach((nft) => {
      const localNFTId = `${networkId}__${nft.collectionAddress}__${nft.itemId}`;
      nftMap[localNFTId] = nft;
    });

    return simpleDb.localNFTs.updateNFTs(nftMap);
  }

  @backgroundMethod()
  public async getNFT(params: {
    networkId: string;
    nftId: string;
    collectionAddress: string;
  }) {
    try {
      return {
        ...(await this._getNFTMemo(params)),
      };
    } catch (error) {
      return Promise.resolve(undefined);
    }
  }

  _getNFTMemo = memoizee(
    async ({
      networkId,
      nftId,
      collectionAddress,
    }: {
      networkId: string;
      nftId: string;
      collectionAddress: string;
    }) => {
      const nftMap = (await simpleDb.localNFTs.getRawData())?.data;
      const localNFTId = `${networkId}__${collectionAddress}__${nftId}`;
      if (nftMap) {
        const nft = nftMap[localNFTId];
        if (nft) {
          return nft;
        }
      }

      try {
        const nftDetails = await this.fetchNFTDetails({
          networkId,
          itemId: nftId,
          collectionAddress,
        });
        return nftDetails;
      } catch (error) {
        console.log('fetchNFTDetails ERROR:', error);
      }

      throw new Error('getNFT ERROR: nft not found.');
    },
    {
      promise: true,
      primitive: true,
      max: 100,
      maxAge: getTimeDurationMs({ minute: 5 }),
    },
  );
}

export default ServiceNFT;
