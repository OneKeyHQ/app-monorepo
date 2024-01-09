import type { IToken } from '@onekeyhq/shared/types/token';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';
import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

export interface ILocalTokens {
  data: Record<string, IToken[]>; // <networkId, tokens>
}

export class SimpleDbEntityLocalTokens extends SimpleDbEntityBase<ILocalTokens> {
  entityName = 'localTokens';

  override enableCache = false;

  @backgroundMethod()
  async updateTokens(tokenMap: Record<string, IToken[]>) {
    const rawData = await this.getRawData();
    return this.setRawData({
      data: {
        ...rawData?.data,
        ...tokenMap,
      },
    });
  }
}
