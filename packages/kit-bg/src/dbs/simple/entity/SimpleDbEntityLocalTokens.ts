import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IToken } from '@onekeyhq/shared/types/token';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface ILocalTokens {
  data: Record<string, IToken>; // <networkId_tokenIdOnNetwork, token>
}

export class SimpleDbEntityLocalTokens extends SimpleDbEntityBase<ILocalTokens> {
  entityName = 'localTokens';

  override enableCache = false;

  @backgroundMethod()
  async updateTokens(tokenMap: Record<string, IToken>) {
    const rawData = await this.getRawData();
    return this.setRawData({
      data: {
        ...rawData?.data,
        ...tokenMap,
      },
    });
  }
}
