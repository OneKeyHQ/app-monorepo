import type {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class SwapOrderLongPendingWarningScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapOrderLongPendingWarning({
    pendingMinutes,
    protocol,
    receivedChain,
    sourceChain,
    status,
    swapProvider,
    swapProviderName,
  }: {
    pendingMinutes: number;
    protocol: EProtocolOfExchange;
    receivedChain: string;
    sourceChain: string;
    status: ESwapTxHistoryStatus;
    swapProvider: string;
    swapProviderName: string;
  }) {
    return {
      pendingMinutes,
      protocol,
      receivedChain,
      sourceChain,
      status,
      swapProvider,
      swapProviderName,
    };
  }
}
