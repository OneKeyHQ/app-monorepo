import qs from 'querystring';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IFetchAccountNFTsParams,
  IFetchAccountNFTsResp,
  IFetchNFTDetailsParams,
  IFetchNFTDetailsResp,
} from '@onekeyhq/shared/types/nft';

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
    }>(`/wallet/v1/account/nft/list?${qs.stringify(params)}`);
    return resp.data.data;
  }

  @backgroundMethod()
  public async fetchNFTDetails(params: IFetchNFTDetailsParams) {
    const client = await this.getClient();
    const { nfts, ...rest } = params;
    const resp = await client.post<IFetchNFTDetailsResp>(
      '/wallet/v1/account/nft/detail',
      {
        ...rest,
        nftIds: nfts.map((nft) => `${nft.collectionAddress}:${nft.itemId}`),
      },
    );
    return resp.data.data;
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
      const nftDetails = await this.fetchNFTDetails({
        networkId,
        nfts: [{ collectionAddress, itemId: nftId }],
      });
      return nftDetails[0];
    },
    {
      promise: true,
      primitive: true,
      max: 10,
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
    },
  );
}

export default ServiceNFT;
