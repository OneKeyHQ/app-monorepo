import type { IEarnOrderTrackingInfo } from '@onekeyhq/shared/types/staking';
import type { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

type IEarnOrderServerLogParams = IEarnOrderTrackingInfo & {
  status: EDecodedTxStatus;
};

export class OrderScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public addOrder(params: IEarnOrderServerLogParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public updateOrderStatus(params: IEarnOrderServerLogParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public updateOrderStatusError(params: { status: EDecodedTxStatus }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public updateOrderStatusByTxId(params: IEarnOrderServerLogParams) {
    return params;
  }
}
