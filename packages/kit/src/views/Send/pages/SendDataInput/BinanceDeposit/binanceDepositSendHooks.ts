import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EBinanceDepositLocalErrorCode } from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { getBinanceDepositEventContext } from '@onekeyhq/shared/src/utils/binanceDepositUtils';
import { EBinanceDepositErrorCode } from '@onekeyhq/shared/types/binanceDeposit';
import type { IBinanceDepositSendContext } from '@onekeyhq/shared/types/binanceDeposit';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import type { IntlShape } from 'react-intl';

// Only a conflict says the address can't be trusted; a gone address sends
// the user back for a new one. A pause or the rate limit is named as such,
// and no answer leaves the user here to confirm again.
function getVerifyFailure(intl: IntlShape, code: number | undefined) {
  const t = (id: ETranslations) => intl.formatMessage({ id });
  switch (code) {
    case EBinanceDepositErrorCode.FeatureDisabled:
    case EBinanceDepositErrorCode.DepositDisabled:
      return {
        type: 'unavailable',
        title: t(ETranslations.binance_deposit_asset_unavailable__msg),
        message: undefined,
      } as const;
    case EBinanceDepositErrorCode.RateLimited:
      return {
        type: 'unavailable',
        title: t(ETranslations.global_request_limit),
        message: undefined,
      } as const;
    case EBinanceDepositLocalErrorCode.VerifyFailed:
      return {
        type: 'conflict',
        title: t(ETranslations.binance_deposit_verify_failed__title),
        message: t(ETranslations.binance_deposit_verify_failed__desc),
      } as const;
    case EBinanceDepositLocalErrorCode.DestinationInvalid:
      return {
        type: 'invalid',
        title: t(ETranslations.binance_deposit_address_invalid__title),
        message: t(ETranslations.binance_deposit_get_new_address__desc),
      } as const;
    default:
      return {
        type: 'unavailable',
        title: t(ETranslations.binance_deposit_verify_unavailable__title),
        message: t(ETranslations.binance_deposit_verify_unavailable__desc),
      } as const;
  }
}

export function buildBinanceDepositSendHooks({
  intl,
  context,
  toAddress,
  memo,
  senderAddress,
  onSuccess,
}: {
  intl: IntlShape;
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
      } catch (error) {
        const code = (error as { code?: number } | undefined)?.code;
        const failure = getVerifyFailure(intl, code);
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
