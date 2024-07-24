import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../decorators';

export class CreateOrderScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapCreateOrder({
    swapType,
    sourceChain,
    receivedChain,
    fromAddress,
    toAddress,
    sourceTokenSymbol,
    receivedTokenSymbol,
    swapAmount,
    swapValue,
    feeType,
    isFirstTime,
    router,
    slippage,
  }: {
    swapType: string;
    slippage: string;
    router?: string;
    sourceChain: string;
    receivedChain: string;
    fromAddress: string;
    toAddress: string;
    sourceTokenSymbol: string;
    receivedTokenSymbol: string;
    swapAmount: string;
    swapValue: string;
    feeType: string;
    isFirstTime: boolean;
  }) {
    return {
      isFirstTime,
      swapType,
      sourceChain,
      receivedChain,
      fromAddress,
      toAddress,
      sourceTokenSymbol,
      receivedTokenSymbol,
      swapAmount,
      swapValue,
      feeType,
      router,
      slippage,
    };
  }
}
