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
    quoteToTokenAmount,
    fromTokenAmount,
    toTokenAmount,
    fromAddress,
    toAddress,
    orderId,
    orderType,
    tradeSide,
    stockTokenSymbol,
    stockTokenAddress,
  }: {
    status: ESwapEventAPIStatus;
    message?: string;
    swapType: string;
    orderType?: string;
    tradeSide?: string;
    stockTokenSymbol?: string;
    stockTokenAddress?: string;
    slippage: string;
    router?: string;
    quoteToTokenAmount?: string;
    sourceChain: string;
    swapProvider: string;
    swapProviderName: string;
    receivedChain: string;
    sourceTokenSymbol: string;
    receivedTokenSymbol: string;
    feeType: string;
    isFirstTime: boolean;
    createFrom: string;
    toTokenAmount: string;
    fromTokenAmount: string;
    fromAddress: string;
    toAddress: string;
    orderId?: string;
  }) {
    void fromAddress;
    void toAddress;
    return {
      orderId,
      quoteToTokenAmount,
      fromTokenAmount,
      toTokenAmount,
      status,
      message,
      isFirstTime,
      swapType,
      orderType,
      tradeSide,
      stockTokenSymbol,
      stockTokenAddress,
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
