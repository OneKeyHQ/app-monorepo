import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { isEarnSwapRecovery } from '@onekeyhq/shared/src/utils/earnSwapRecovery';
import type { IEarnSwapRecovery } from '@onekeyhq/shared/types/earn/funding';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';
import type {
  ISwapToken,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { generateSwapHistoryItemForContext } from '../../../Swap/hooks/useSwapTxHistory';
import { buildSwapHistoryIdentity } from '../../../Swap/utils/swapHistoryIdentity';

import type { IEarnSwapPrepared } from './earnRouterSwap';

function recoveryToken(token: ISwapToken) {
  return {
    networkId: token.networkId,
    contractAddress: token.contractAddress,
    symbol: token.symbol,
    decimals: token.decimals,
    ...(token.isNative !== undefined ? { isNative: token.isNative } : {}),
    ...(token.name ? { name: token.name } : {}),
    ...(token.logoURI ? { logoURI: token.logoURI } : {}),
  };
}

export function createEarnSwapRecovery({
  prepared,
  currencyInfo,
}: {
  prepared: IEarnSwapPrepared;
  currencyInfo: { id: string; symbol: string };
}): IEarnSwapRecovery {
  const info = prepared.execution.swapInfo;
  const identity = buildSwapHistoryIdentity({
    buildRes: info.swapBuildResData,
    protocol: EProtocolOfExchange.SWAP,
    txId: 'pending',
  });
  const recovery = {
    sender: {
      accountId: prepared.payer.accountId,
      networkId: prepared.payer.networkId,
      address: info.accountAddress,
      amount: info.sender.amount,
      token: recoveryToken(info.sender.token),
    },
    receiver: {
      accountId: prepared.receiver.accountId,
      networkId: prepared.receiver.networkId,
      address: info.receivingAddress,
      amount: info.receiver.amount,
      token: recoveryToken(info.receiver.token),
    },
    provider: {
      provider: info.swapBuildResData.result.info.provider,
      providerName:
        info.swapBuildResData.result.info.providerName ||
        info.swapBuildResData.result.info.provider,
      ...(info.swapBuildResData.result.info.providerLogo
        ? { providerLogo: info.swapBuildResData.result.info.providerLogo }
        : {}),
    },
    ...(identity.serviceOrderId
      ? { serviceOrderId: identity.serviceOrderId }
      : {}),
    ...(identity.orderId ? { orderId: identity.orderId } : {}),
    useOrderId: identity.useOrderId,
    ...(info.swapBuildResData.ctx !== undefined
      ? { ctx: info.swapBuildResData.ctx }
      : {}),
    currency: { id: currencyInfo.id, symbol: currencyInfo.symbol },
    createdAt: Date.now(),
  };
  if (!isEarnSwapRecovery(recovery))
    throw new OneKeyLocalError('Invalid Earn swap recovery');
  return recovery;
}

export async function persistEarnSwapHistory({
  txId,
  swapInfo,
  sent,
  currencyInfo,
}: {
  txId: string;
  swapInfo: ISwapTxInfo;
  sent?: ISendTxOnSuccessData;
  currencyInfo: { id: string; symbol: string };
}) {
  const swapNetworks = await backgroundApiProxy.serviceSwap
    .fetchSwapNetworks()
    .catch(() => []);
  const result = await generateSwapHistoryItemForContext(
    {
      txId,
      swapTxInfo: swapInfo,
      gasFeeFiatValue: sent?.decodedTx.totalFeeFiatValue,
      gasFeeInNative: sent?.decodedTx.totalFeeInNative,
    },
    { swapNetworks, currencyInfo },
  );
  if (!result?.durable) {
    throw new OneKeyLocalError('Unable to persist Earn swap history');
  }
}
