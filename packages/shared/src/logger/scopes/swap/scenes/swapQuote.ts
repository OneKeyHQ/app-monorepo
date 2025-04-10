import type { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class SwapQuoteScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapQuote({
    walletType,
    quoteType,
    slippageSetting,
    sourceChain,
    receivedChain,
    sourceTokenSymbol,
    receivedTokenSymbol,
    isAddReceiveAddress,
    isSmartMode,
  }: {
    walletType: string;
    quoteType: ESwapTabSwitchType;
    slippageSetting?: 'auto' | 'custom';
    sourceChain: string;
    receivedChain: string;
    sourceTokenSymbol: string;
    receivedTokenSymbol: string;
    isAddReceiveAddress: boolean;
    isSmartMode: boolean;
  }) {
    return {
      walletType,
      quoteType,
      slippageSetting,
      sourceChain,
      receivedChain,
      sourceTokenSymbol,
      receivedTokenSymbol,
      isAddReceiveAddress,
      isSmartMode,
    };
  }
}
