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
    swapProvider,
    swapProviderName,
    createFrom,
    router,
    slippage,
  }: {
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
  }) {
    return {
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
