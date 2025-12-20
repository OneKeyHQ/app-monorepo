import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IChainResourceDBStruct {
  tronClaimResourceInfo?: Record<
    string,
    {
      lastClaimTime: number;
    }
  >;
}

export class SimpleDbEntityChainResource extends SimpleDbEntityBase<IChainResourceDBStruct> {
  entityName = 'chainResource';

  override enableCache = false;

  @backgroundMethod()
  async getTronClaimResourceInfo({
    accountAddress,
  }: {
    accountAddress: string;
  }) {
    return (await this.getRawData())?.tronClaimResourceInfo?.[accountAddress];
  }

  @backgroundMethod()
  async updateTronClaimResourceInfo({
    accountAddress,
    lastClaimTime,
  }: {
    accountAddress: string;
    lastClaimTime: number;
  }) {
    await this.setRawData((rawData) => ({
      tronClaimResourceInfo: {
        ...rawData?.tronClaimResourceInfo,
        [accountAddress]: { lastClaimTime },
      },
    }));
  }
}
