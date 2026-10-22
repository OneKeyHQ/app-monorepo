import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IBinanceDepositSendContext } from '@onekeyhq/shared/types/exchange';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { BINANCE_DEPOSIT_COPY } from './binanceDepositCopy';

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
        Toast.error({
          title: BINANCE_DEPOSIT_COPY.verifyFailedTitle,
          message: BINANCE_DEPOSIT_COPY.verifyFailedDesc,
        });
        throw new OneKeyLocalError({
          message: BINANCE_DEPOSIT_COPY.verifyFailedTitle,
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
