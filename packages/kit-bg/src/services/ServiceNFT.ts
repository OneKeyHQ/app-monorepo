import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IFetchAccountNFTsParams,
  IFetchAccountNFTsResp,
} from '@onekeyhq/shared/types/nft';

import { getBaseEndpoint } from '../endpoints';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceNFT extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async fetchAccountNFTs(params: IFetchAccountNFTsParams) {
    const client = this.getClient();
    const endpoint = await getBaseEndpoint();
    const resp = await client.get<{
      data: IFetchAccountNFTsResp;
    }>(`${endpoint}/v5/account/nft/list`, {
      params,
    });
    return resp.data.data;
  }
}

export default ServiceNFT;
