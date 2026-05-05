import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ISwapProSelectTokenDBStruct {
  token: ISwapToken | undefined;
  updatedAt: number;
}

export class SimpleDbEntitySwapProSelectToken extends SimpleDbEntityBase<ISwapProSelectTokenDBStruct> {
  entityName = 'swapProSelectToken';

  override enableCache = false;

  @backgroundMethod()
  async getSwapProSelectToken(): Promise<ISwapToken | undefined> {
    const rawData = await this.getRawData();
    return rawData?.token;
  }

  @backgroundMethod()
  async setSwapProSelectToken(token: ISwapToken | undefined) {
    await this.setRawData({
      token,
      updatedAt: Date.now(),
    });
  }
}
