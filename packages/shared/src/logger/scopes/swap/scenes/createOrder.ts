import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class CreateOrderScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapCreateOrder({
    swapType,
    sourceChain,
    receivedChain,
    sourceTokenSymbol,
    receivedTokenSymbol,
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
    sourceTokenSymbol: string;
    receivedTokenSymbol: string;
    feeType: string;
    isFirstTime: boolean;
  }) {
    return {
      isFirstTime,
      swapType,
      sourceChain,
      receivedChain,
      sourceTokenSymbol,
      receivedTokenSymbol,
      feeType,
      router,
      slippage,
    };
  }
}
