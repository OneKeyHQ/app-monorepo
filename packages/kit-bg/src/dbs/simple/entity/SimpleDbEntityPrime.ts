import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ISimpleDBPrime {
  authToken: string;
}

export class SimpleDbEntityPrime extends SimpleDbEntityBase<ISimpleDBPrime> {
  entityName = 'prime';

  override enableCache = true;

  async getAuthToken(): Promise<string> {
    const rawData = await this.getRawData();
    return rawData?.authToken || '';
  }

  @backgroundMethod()
  async saveAuthToken(authToken: string) {
    await this.setRawData((v) => ({
      ...v,
      authToken,
    }));
  }
}
