import qs from 'querystring';

import { isNil, omitBy } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IFetchAccountDefiParams,
  IFetchAccountDefiResp,
} from '@onekeyhq/shared/types/defi';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

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
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const resp = await client.get<{
      data: IFetchAccountDefiResp;
    }>(`/wallet/v1/account/defi/list?${qs.stringify(omitBy(params, isNil))}`);
    return resp.data.data;
  }
}

export default ServiceDefi;
