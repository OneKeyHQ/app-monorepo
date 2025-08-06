import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { ESwapEventAPIStatus } from './swapEstimateFee';

export class CreateOrderScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapCreateOrder({
    swapType,
    message,
    status,
    sourceChain,
    receivedChain,
    sourceTokenSymbol,
    receivedTokenSymbol,
    feeType,
    isFirstTime,
    swapProvider,
    swapProviderName,
    createFrom,
    router,
    slippage,
    quoteToAmount,
  }: {
    status: ESwapEventAPIStatus;
    message?: string;
    swapType: string;
    slippage: string;
    router?: string;
    sourceChain: string;
    swapProvider: string;
    swapProviderName: string;
    receivedChain: string;
    sourceTokenSymbol: string;
    receivedTokenSymbol: string;
    feeType: string;
    isFirstTime: boolean;
    createFrom: string;
    quoteToAmount: string;
  }) {
    return {
      quoteToAmount,
      status,
      message,
      isFirstTime,
      swapType,
      sourceChain,
      receivedChain,
      sourceTokenSymbol,
      receivedTokenSymbol,
      swapProvider,
      swapProviderName,
      feeType,
      router,
      slippage,
      createFrom,
    };
  }
}
