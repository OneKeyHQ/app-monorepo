import { SimpleDbEntityBase } from '../SimpleDbEntityBase';

import type { ISwapToken } from '../../../../services/ServiceSwap';

export interface ISwapSourceTokens {
  data: Record<string, { tokens: ISwapToken[]; updateAt: number }>;
}

export class SimpleDbEntitySwapSourceTokens extends SimpleDbEntityBase<ISwapSourceTokens> {
  entityName = 'swapSourceTokens';

  override enableCache = true;

  async updateSwapSourceTokens(networkId: string, tokens: ISwapToken[]) {
    const rawData = await this.getRawData();
    const newRawData = {
      ...rawData,
      data: {
        ...rawData?.data,
        [networkId]: {
          tokens,
          updateAt: Date.now(),
        },
      },
    };
    await this.setRawData(newRawData);
  }
}
