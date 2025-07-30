import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export enum ESwapEventAPIStatus {
  SUCCESS = 'success',
  FAIL = 'fail',
  PARTIAL_SUCCESS = 'partial_success',
}

export class SwapEstimateFeeScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapEstimateFee({
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
    isBatch,
  }: {
    orderId: string;
    status: ESwapEventAPIStatus;
    message?: string;
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
    networkId: string;
    accountId: string;
    encodedTx: string;
    isBatch?: boolean;
  }) {
    return {
      status,
      orderId,
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
      networkId,
      accountId,
      encodedTx,
      isBatch,
    };
  }
}
