import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
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
}

export default ServiceNFT;
