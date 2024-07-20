import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceCustomToken extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async addCustomToken({ token }: { token: IAccountToken }) {
    return this.backgroundApi.simpleDb.customTokens.addCustomToken({ token });
  }

  @backgroundMethod()
  public async hideToken({ token }: { token: IAccountToken }) {
    return this.backgroundApi.simpleDb.customTokens.hideToken({ token });
  }

  @backgroundMethod()
  public async getCustomTokens({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    return this.backgroundApi.simpleDb.customTokens.getCustomTokens({
      accountId,
      networkId,
    });
  }

  @backgroundMethod()
  public async getHiddenTokens({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    return this.backgroundApi.simpleDb.customTokens.getHiddenTokens({
      accountId,
      networkId,
    });
  }
}

export default ServiceCustomToken;
