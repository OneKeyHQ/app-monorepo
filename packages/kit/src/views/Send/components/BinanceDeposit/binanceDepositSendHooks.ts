import BigNumber from 'bignumber.js';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { getBinanceDepositEventContext } from '@onekeyhq/shared/src/utils/binanceDepositUtils';
import type { IBinanceDepositSendContext } from '@onekeyhq/shared/types/binanceDeposit';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import {
  getBinanceDepositErrorCode,
  getBinanceDepositVerifyFailure,
} from './binanceDepositErrors';

import type { IntlShape } from 'react-intl';

export function buildBinanceDepositSendHooks({
  intl,
  context,
  toAddress,
  memo,
  tokenSymbol,
  senderAddress,
  onSuccess,
}: {
  intl: IntlShape;
  context: IBinanceDepositSendContext;
  toAddress: string;
  memo?: string;
  // As the amount page names the token in its minimum hint.
  tokenSymbol?: string;
  senderAddress: string;
  onSuccess?: (txs: ISendTxOnSuccessData[]) => void;
}) {
  return {
    // The confirm page runs this right before signing; a throw stops it.
    onBeforeSend: async (params?: { nativeMaxSendAmount?: string }) => {
      // A native Max send has its fee taken out on the confirm page, after the
      // amount page held the whole balance against Binance's minimum. Below
      // that minimum the deposit may never be credited.
      const minAmount = new BigNumber(context.minAmount ?? 0);
      if (
        params?.nativeMaxSendAmount !== undefined &&
        minAmount.gt(0) &&
        new BigNumber(params.nativeMaxSendAmount).lt(minAmount)
      ) {
        const title = intl.formatMessage(
          { id: ETranslations.send_error_minimum_amount },
          {
            amount: minAmount.toFixed(),
            token: tokenSymbol ?? context.cryptoCurrency,
          },
        );
        defaultLogger.transaction.send.binanceDepositVerifyFail({
          ...getBinanceDepositEventContext(context),
          type: 'below_minimum',
        });
        Toast.error({ title });
        throw new OneKeyLocalError({ message: title, autoToast: false });
      }
      try {
        await backgroundApiProxy.serviceBinanceDeposit.verifyBeforeSign({
          localId: context.localId,
          toAddress,
          memo,
        });
      } catch (error) {
        const code = getBinanceDepositErrorCode(error);
        const failure = getBinanceDepositVerifyFailure(intl, code);
        defaultLogger.transaction.send.binanceDepositVerifyFail({
          ...getBinanceDepositEventContext(context),
          type: failure.type,
          errorCode: code,
        });
        Toast.error({ title: failure.title, message: failure.message });
        throw new OneKeyLocalError({
          message: failure.title,
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
