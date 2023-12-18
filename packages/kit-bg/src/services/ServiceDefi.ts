import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IFetchAccountDefiParams,
  IFetchAccountDefiResp,
} from '@onekeyhq/shared/types/defi';

import { getBaseEndpoint } from '../endpoints';

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
    const client = this.getClient();
    const endpoint = await getBaseEndpoint();
    const resp = await client.get<{
      data: IFetchAccountDefiResp;
    }>(`${endpoint}/v5/account/defi/list`, {
      params,
    });
    return resp.data.data;
  }
}

export default ServiceDefi;
