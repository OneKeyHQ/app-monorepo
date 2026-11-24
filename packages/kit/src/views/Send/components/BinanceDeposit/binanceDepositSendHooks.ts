import BigNumber from 'bignumber.js';

import { Toast } from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EBinanceDepositLocalErrorCode } from '@onekeyhq/shared/src/consts/binanceDepositConsts';
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
  accountId,
  amount,
  senderAddress,
  onMinimumChange,
  onSuccess,
}: {
  intl: IntlShape;
  context: IBinanceDepositSendContext;
  toAddress: string;
  memo?: string;
  // As the amount page names the token in its minimum hint.
  tokenSymbol?: string;
  // The account that signs, for reading the prepared transaction.
  accountId?: string;
  // The amount the amount page put in the transfer.
  amount?: string;
  senderAddress: string;
  // Binance raised its minimum since this page read it.
  onMinimumChange?: (minAmount: string) => void;
  onSuccess?: (txs: ISendTxOnSuccessData[]) => void;
}) {
  return {
    // The confirm page runs this right before signing; a throw stops it.
    onBeforeSend: async (params?: {
      nativeMaxSendAmount?: string;
      unsignedTxs?: IUnsignedTxPro[];
    }) => {
      const minAmount = new BigNumber(context.minAmount ?? 0);
      const hasMinimum = minAmount.isFinite() && minAmount.gt(0);
      // Below Binance's minimum the deposit may never be credited.
      const refuseBelowMinimum = (
        errorCode?: number,
        latestMinAmount?: string,
      ) => {
        const title = intl.formatMessage(
          { id: ETranslations.send_error_minimum_amount },
          {
            amount: latestMinAmount ?? minAmount.toFixed(),
            token: tokenSymbol ?? context.cryptoCurrency,
          },
        );
        defaultLogger.transaction.send.binanceDepositVerifyFail({
          ...getBinanceDepositEventContext(context),
          type: 'below_minimum',
          ...(errorCode === undefined ? undefined : { errorCode }),
        });
        Toast.error({ title });
        return new OneKeyLocalError({ message: title, autoToast: false });
      };
      // A native Max send has its fee taken out on the confirm page, after the
      // amount page held the whole balance against the minimum.
      if (
        params?.nativeMaxSendAmount !== undefined &&
        hasMinimum &&
        new BigNumber(params.nativeMaxSendAmount).lt(minAmount)
      ) {
        throw refuseBelowMinimum();
      }
      try {
        await backgroundApiProxy.serviceBinanceDeposit.verifyBeforeSign({
          localId: context.localId,
          toAddress,
          memo,
          accountId,
          // The background reads what this transaction really sends: a vault
          // may take the fee out of it on its own.
          unsignedTx: params?.unsignedTxs?.[0],
          amount,
        });
      } catch (error) {
        const code = getBinanceDepositErrorCode(error);
        if (code === EBinanceDepositLocalErrorCode.BelowMinimum) {
          // The check holds the amount against the minimum the server names
          // now, which may be higher than the one this page read: that value
          // is shown, and handed back for the amount page to use.
          const latestMinAmount = await backgroundApiProxy.serviceBinanceDeposit
            .getSnapshot(context.localId)
            .then(
              (snapshot) => snapshot?.destination?.minAmount,
              () => undefined,
            );
          if (latestMinAmount) {
            onMinimumChange?.(latestMinAmount);
          }
          throw refuseBelowMinimum(code, latestMinAmount);
        }
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
