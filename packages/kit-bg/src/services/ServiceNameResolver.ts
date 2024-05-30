import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IResolveNameParams,
  IResolveNameResp,
} from '@onekeyhq/shared/types/name';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceNameResolver extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async resolveName({
    name,
    networkId,
  }: IResolveNameParams): Promise<IResolveNameResp | undefined | null> {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    try {
      const resp = await client.get<{
        data: IResolveNameResp;
      }>('/wallet/v1/account/resolve-name', {
        params: {
          name,
          networkId,
        },
      });
      return resp.data.data;
    } catch {
      return undefined;
    }
  }
}

export default ServiceNameResolver;
