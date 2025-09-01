import type { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { ESwapEventAPIStatus } from './swapEstimateFee';

export interface ISwapQuoteProvideResult {
  provider: string;
  providerName: string;
  toAmount?: string;
  errorMessage?: string;
}

export class SwapQuoteScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapQuote({
    walletType,
    status,
    quoteType,
    message,
    slippageSetting,
    sourceChain,
    receivedChain,
    sourceTokenSymbol,
    receivedTokenSymbol,
    isAddReceiveAddress,
    isSmartMode,
    providerQuoteResult,
    fromAddress,
    toAddress,
  }: {
    walletType: string;
    status: ESwapEventAPIStatus;
    message?: string;
    quoteType: ESwapTabSwitchType;
    providerQuoteResult: ISwapQuoteProvideResult[];
    slippageSetting?: 'auto' | 'custom';
    sourceChain: string;
    receivedChain: string;
    sourceTokenSymbol: string;
    receivedTokenSymbol: string;
    isAddReceiveAddress: boolean;
    isSmartMode: boolean;
    fromAddress: string;
    toAddress: string;
  }) {
    return {
      walletType,
      status,
      message,
      quoteType,
      slippageSetting,
      sourceChain,
      receivedChain,
      sourceTokenSymbol,
      receivedTokenSymbol,
      isAddReceiveAddress,
      isSmartMode,
      providerQuoteResult,
      fromAddress,
      toAddress,
    };
  }
}
