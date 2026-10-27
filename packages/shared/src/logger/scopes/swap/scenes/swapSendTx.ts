import {
  getSwapErrorMessage,
  getSwapErrorType,
} from '@onekeyhq/shared/src/utils/sensitiveErrorMessageUtils';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import { ESwapEventAPIStatus } from './swapEstimateFee';

export class SwapSendTxScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapSendTx({
    reviewSessionId,
    quoteId,
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
    error,
    orderId,
    networkId,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    accountId: _accountId,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    encodedTx: _encodedTx,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fromAddress: _fromAddress,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    toAddress: _toAddress,
    quoteToTokenAmount,
  }: {
    reviewSessionId?: string;
    quoteId?: string;
    status: ESwapEventAPIStatus;
    // The raw error stays here: only fixed categories and allowlisted
    // identifiers derived from it reach the server.
    error?: unknown;
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
      reviewSessionId,
      quoteId,
      status,
      ...(status === ESwapEventAPIStatus.FAIL
        ? { message: getSwapErrorMessage(error), ...getSwapErrorType(error) }
        : undefined),
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
      quoteToTokenAmount,
    };
  }
}
