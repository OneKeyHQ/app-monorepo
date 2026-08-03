import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { ISwapTxInfo } from '@onekeyhq/shared/types/swap/types';

type IGenerateSwapHistoryItem = (params: {
  txId?: string;
  gasFeeInNative?: string;
  gasFeeFiatValue?: string;
  swapTxInfo: ISwapTxInfo;
}) => Promise<{ durable: boolean } | void>;

type IOnSwapBroadcast = () => void | Promise<void>;

/**
 * The transaction is already out on the network by the time this runs, so a
 * history failure must not abort the rest of the post-broadcast flow. It still
 * has to be distinguishable in logs from a clean write: a swap recorded only in
 * the non-persisted notification atom disappears on the next runtime restart,
 * and the user is left with a broadcast transaction and no record of it.
 */
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
    const result = await generateSwapHistoryItem(historyParams);
    if (result && !result.durable) {
      defaultLogger.app.error.log(
        `Swap history after ${source} was not persisted durably; it will be lost on restart`,
      );
    }
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
