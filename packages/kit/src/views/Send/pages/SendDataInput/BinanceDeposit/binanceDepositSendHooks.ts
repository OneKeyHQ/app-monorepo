import BigNumber from 'bignumber.js';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IBinanceDepositSendContext } from '@onekeyhq/shared/types/exchange';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { BINANCE_DEPOSIT_COPY } from './binanceDepositCopy';

// The minimum Binance credits; a transfer below it may never arrive, so it
// is blocked rather than warned about.
export function validateBinanceDepositAmount(
  context: IBinanceDepositSendContext | undefined,
  tokenAmount: BigNumber,
): string | undefined {
  if (!context?.minAmount) {
    return undefined;
  }
  const minAmount = new BigNumber(context.minAmount);
  if (minAmount.isNaN() || !tokenAmount.isLessThan(minAmount)) {
    return undefined;
  }
  return BINANCE_DEPOSIT_COPY.minAmount(
    context.minAmount,
    context.cryptoCurrency,
  );
}

export function buildBinanceDepositSendHooks({
  context,
  toAddress,
  memo,
  senderAddress,
  onSuccess,
}: {
  context: IBinanceDepositSendContext;
  toAddress: string;
  memo?: string;
  senderAddress: string;
  onSuccess?: (txs: ISendTxOnSuccessData[]) => void;
}) {
  return {
    // The confirm page runs this right before signing; a throw stops it.
    onBeforeSend: async () => {
      try {
        await backgroundApiProxy.serviceBinanceDeposit.verifyBeforeSign({
          localId: context.localId,
          toAddress,
          memo,
        });
      } catch {
        Toast.error({ title: BINANCE_DEPOSIT_COPY.verifyFailed });
        throw new OneKeyLocalError({
          message: BINANCE_DEPOSIT_COPY.verifyFailed,
          autoToast: false,
        });
      }
    },
    // Best effort after the broadcast. The confirm page treats a throwing
    // success callback as a failed send, so nothing escapes from here.
    onSuccess: (txs: ISendTxOnSuccessData[]) => {
      try {
        const tx = txs[0];
        const txid = tx?.signedTx?.txid;
        if (txid) {
          void backgroundApiProxy.serviceBinanceDeposit
            .reportDeposit({
              localId: context.localId,
              txid,
              senderAddress: tx.decodedTx?.owner || senderAddress,
            })
            .catch(() => undefined);
        }
      } catch {
        // Reporting never affects the send.
      }
      onSuccess?.(txs);
    },
  };
}
