import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { ISwapTxInfo } from '@onekeyhq/shared/types/swap/types';

type IGenerateSwapHistoryItem = (params: {
  txId?: string;
  gasFeeInNative?: string;
  gasFeeFiatValue?: string;
  swapTxInfo: ISwapTxInfo;
}) => Promise<void>;

type IOnSwapBroadcast = () => void | Promise<void>;

async function persistSwapHistory({
  generateSwapHistoryItem,
  historyParams,
  source,
}: {
  generateSwapHistoryItem: IGenerateSwapHistoryItem;
  historyParams: Parameters<IGenerateSwapHistoryItem>[0];
  source: 'broadcast' | 'signedNoSend';
}) {
  try {
    await generateSwapHistoryItem(historyParams);
  } catch (error) {
    defaultLogger.app.error.log(
      `Failed to persist Swap history after ${source}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export async function completeBroadcastedSwapSuccess({
  txId,
  swapInfo,
  gasFeeFiatValue,
  gasFeeInNative,
  generateSwapHistoryItem,
  onSwapBroadcast,
}: {
  txId: string;
  swapInfo: ISwapTxInfo;
  gasFeeFiatValue?: string;
  gasFeeInNative?: string;
  generateSwapHistoryItem: IGenerateSwapHistoryItem;
  onSwapBroadcast?: IOnSwapBroadcast;
}) {
  const historyPromise = persistSwapHistory({
    generateSwapHistoryItem,
    historyParams: {
      txId,
      swapTxInfo: swapInfo,
      gasFeeFiatValue,
      gasFeeInNative,
    },
    source: 'broadcast',
  });
  await onSwapBroadcast?.();
  await historyPromise;
}

export async function completeSignedNoSendSwapSuccess({
  swapInfo,
  generateSwapHistoryItem,
  onSwapBroadcast,
}: {
  swapInfo: ISwapTxInfo;
  generateSwapHistoryItem: IGenerateSwapHistoryItem;
  onSwapBroadcast?: IOnSwapBroadcast;
}) {
  const historyPromise = persistSwapHistory({
    generateSwapHistoryItem,
    historyParams: {
      swapTxInfo: swapInfo,
    },
    source: 'signedNoSend',
  });
  await onSwapBroadcast?.();
  await historyPromise;
}
