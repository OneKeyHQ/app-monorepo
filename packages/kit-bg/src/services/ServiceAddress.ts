import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IFetchAddressDetailsParams,
  IFetchAddressDetailsResp,
} from '@onekeyhq/shared/types/address';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceAddress extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async fetchAddressDetails(
    params: IFetchAddressDetailsParams,
  ): Promise<IFetchAddressDetailsResp> {
    const client = await this.getClient();
    const resp = await client.get<{
      data: IFetchAddressDetailsResp;
    }>('/wallet/v1/account/get-account', {
      params,
    });
    return resp.data.data;
  }
}

export default ServiceAddress;
