import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import type {
  IFetchAccountNFTsParams,
  IFetchAccountNFTsResp,
  IFetchNFTDetailsParams,
  IFetchNFTDetailsResp,
} from '@onekeyhq/shared/types/nft';

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
      max: 10,
      maxAge: getTimeDurationMs({ minute: 5 }),
    },
  );
}

export default ServiceNFT;
