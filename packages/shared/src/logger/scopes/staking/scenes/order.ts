import type { IAddEarnOrderParams } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityEarnOrders';
import type { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class OrderScene extends BaseScene {
  @LogToLocal()
  public addOrder(order: IAddEarnOrderParams) {
    return order;
  }

  @LogToLocal()
  public updateOrderStatus(params: { txId: string; status: EDecodedTxStatus }) {
    return params;
  }

  @LogToLocal()
  public updateOrderStatusError(params: {
    txId: string;
    status: EDecodedTxStatus;
  }) {
    return params;
  }

  @LogToLocal()
  public updateOrderStatusByTxId(params: {
    currentTxId: string;
    newTxId?: string;
    status: EDecodedTxStatus;
  }) {
    return params;
  }
}
