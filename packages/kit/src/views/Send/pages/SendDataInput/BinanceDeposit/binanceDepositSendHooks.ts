import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EBinanceDepositLocalErrorCode } from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IBinanceDepositSendContext } from '@onekeyhq/shared/types/exchange';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { BINANCE_DEPOSIT_COPY } from './binanceDepositCopy';

// Only a conflict says the address can't be trusted; a gone address sends
// the user back for a new one, and no answer leaves them here to confirm
// again.
function getVerifyFailure(error: unknown) {
  const copy = BINANCE_DEPOSIT_COPY;
  switch ((error as { code?: number } | undefined)?.code) {
    case EBinanceDepositLocalErrorCode.VerifyFailed:
      return {
        type: 'conflict',
        title: copy.verifyFailedTitle,
        message: copy.verifyFailedDesc,
      } as const;
    case EBinanceDepositLocalErrorCode.DestinationInvalid:
      return {
        type: 'invalid',
        title: copy.destinationInvalidTitle,
        message: copy.destinationInvalidDesc,
      } as const;
    default:
      return {
        type: 'unavailable',
        title: copy.verifyUnavailableTitle,
        message: copy.verifyUnavailableDesc,
      } as const;
  }
}

export function buildBinanceDepositSendHooks({
  context,
  networkId,
  tokenSymbol,
  toAddress,
  memo,
  senderAddress,
  onSuccess,
}: {
  context: IBinanceDepositSendContext;
  networkId: string;
  tokenSymbol?: string;
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
      } catch (error) {
        const { type, title, message } = getVerifyFailure(error);
        defaultLogger.transaction.send.binanceDepositVerifyFail({
          network: networkId,
          tokenSymbol,
          type,
        });
        Toast.error({ title, message });
        throw new OneKeyLocalError({ message: title, autoToast: false });
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
