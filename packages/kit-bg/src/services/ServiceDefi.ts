import qs from 'querystring';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IFetchAccountDefiParams,
  IFetchAccountDefiResp,
} from '@onekeyhq/shared/types/defi';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceDefi extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async fetchAccountDefi(
    params: IFetchAccountDefiParams,
  ): Promise<IFetchAccountDefiResp> {
    const client = await this.getClient();
    const resp = await client.get<{
      data: IFetchAccountDefiResp;
    }>(`/wallet/v1/account/defi/list?${qs.stringify(params)}`);
    return resp.data.data;
  }
}

export default ServiceDefi;
