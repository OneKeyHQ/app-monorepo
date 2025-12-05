import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ISimpleDBPrime {
  authToken: string;
}

// TODO move supabase Storage here

export class SimpleDbEntityPrime extends SimpleDbEntityBase<ISimpleDBPrime> {
  entityName = 'prime';

  override enableCache = true;

  // TODO get from supabase storage
  @backgroundMethod()
  async getAuthToken(): Promise<string> {
    const rawData = await this.getRawData();
    return `${rawData?.authToken || ''}`;
  }

  // TODO remove, if not authToken, clear supabase storage
  @backgroundMethod()
  async saveAuthToken(authToken: string) {
    await this.setRawData((v) => ({
      ...v,
      authToken,
    }));
  }
}
