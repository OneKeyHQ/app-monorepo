import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

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
}

export default ServiceToken;
