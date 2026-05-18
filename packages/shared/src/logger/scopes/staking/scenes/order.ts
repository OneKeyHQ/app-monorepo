import type { IAddEarnOrderParams } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityEarnOrders';
import type { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class OrderScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public addOrder(order: IAddEarnOrderParams) {
    return order;
  }

  @LogToServer()
  @LogToLocal()
  public updateOrderStatus(
    params: Pick<
      IAddEarnOrderParams,
      'stakingLabel' | 'stakingProtocol' | 'stakingTags'
    > & {
      txId: string;
      status: EDecodedTxStatus;
    },
  ) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public updateOrderStatusError(params: {
    txId: string;
    status: EDecodedTxStatus;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public updateOrderStatusByTxId(
    params: Pick<
      IAddEarnOrderParams,
      'stakingLabel' | 'stakingProtocol' | 'stakingTags'
    > & {
      currentTxId: string;
      newTxId?: string;
      status: EDecodedTxStatus;
    },
  ) {
    return params;
  }
}
