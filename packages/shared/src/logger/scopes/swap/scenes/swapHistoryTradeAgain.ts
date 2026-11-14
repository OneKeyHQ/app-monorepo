import type {
  ESwapLimitOrderStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

export interface ISwapHistoryTradeAgainEvent {
  status: ESwapTxHistoryStatus | ESwapLimitOrderStatus;
  swapType: 'swap' | 'bridge' | 'stock' | 'limit';
  fromTokenSymbol: string;
  fromNetworkId: string;
  toTokenSymbol: string;
  toNetworkId: string;
  source: 'swapHistoryDetail' | 'limitOrderDetail';
}

export class SwapHistoryTradeAgainScene extends BaseScene {
  @LogToServer({ level: 'info' })
  public swapHistoryTradeAgainClick({
    status,
    swapType,
    fromTokenSymbol,
    fromNetworkId,
    toTokenSymbol,
    toNetworkId,
    source,
  }: ISwapHistoryTradeAgainEvent) {
    return {
      status,
      swapType,
      fromTokenSymbol,
      fromNetworkId,
      toTokenSymbol,
      toNetworkId,
      source,
    };
  }
}
