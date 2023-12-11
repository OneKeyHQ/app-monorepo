import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { getBaseEndpoint } from '../endpoints';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceToken extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async demoFetchAccountTokens(): Promise<IAccountToken[]> {
    const tokens = require('../mocks/home/tokens.json') as IAccountToken[];
    return Promise.resolve(tokens);
  }

  @backgroundMethod()
  public async fetchAccountTokens({
    networkId,
    accountAddress,
  }: {
    networkId: string;
    accountAddress: string;
  }): Promise<IAccountToken[]> {
    const endpoint = await getBaseEndpoint();
    try {
      const tokens = await this.client.post<IAccountToken[]>(
        `${endpoint}/v2/account/account/tokens`,
        {
          networkId,
          accountAddress,
        },
      );

      return tokens.data;
    } catch (e) {
      console.log(e);
      return [];
    }
  }
}

export default ServiceToken;
