import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { ESwapEventAPIStatus } from './swapEstimateFee';

export class SwapSendTxScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapSendTx({
    swapType,
    slippage,
    router,
    fromNetworkId,
    toNetworkId,
    fromTokenSymbol,
    toTokenSymbol,
    fromTokenAmount,
    toTokenAmount,
    provider,
    providerName,
    status,
    message,
    orderId,
    networkId,
    accountId,
    encodedTx,
    fromAddress,
    toAddress,
    quoteToTokenAmount,
  }: {
    status: ESwapEventAPIStatus;
    message?: string;
    orderId: string;
    swapType: string;
    slippage: string;
    router?: string;
    provider: string;
    providerName: string;
    fromNetworkId: string;
    toNetworkId: string;
    fromTokenSymbol: string;
    toTokenSymbol: string;
    fromTokenAmount: string;
    toTokenAmount: string;
    quoteToTokenAmount?: string;
    networkId: string;
    accountId: string;
    encodedTx: string;
    fromAddress: string;
    toAddress: string;
  }) {
    return {
      status,
      message,
      swapType,
      slippage,
      router,
      fromNetworkId,
      toNetworkId,
      fromTokenSymbol,
      toTokenSymbol,
      fromTokenAmount,
      toTokenAmount,
      provider,
      providerName,
      orderId,
      networkId,
      accountId,
      encodedTx,
      fromAddress,
      toAddress,
      quoteToTokenAmount,
    };
  }
}
