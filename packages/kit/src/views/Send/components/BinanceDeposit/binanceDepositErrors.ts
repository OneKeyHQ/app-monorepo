import { EBinanceDepositLocalErrorCode } from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EBinanceDepositErrorCode } from '@onekeyhq/shared/types/binanceDeposit';

import type { IntlShape } from 'react-intl';

// The service throws with a fixed message; the code says what happened.
export function getBinanceDepositErrorCode(error: unknown): number | undefined {
  return (error as { code?: number } | undefined)?.code;
}

// A start, a retry or an open of Binance that was refused.
export function getBinanceDepositErrorTitle(
  intl: IntlShape,
  error: unknown,
): string {
  const t = (id: ETranslations) => intl.formatMessage({ id });
  switch (getBinanceDepositErrorCode(error)) {
    case EBinanceDepositErrorCode.FeatureDisabled:
    case EBinanceDepositErrorCode.DepositDisabled:
    case EBinanceDepositErrorCode.CapabilityStale:
      return t(ETranslations.binance_deposit_asset_unavailable__msg);
    case EBinanceDepositErrorCode.RateLimited:
      return t(ETranslations.global_request_limit);
    default:
      return t(ETranslations.binance_deposit_unavailable__msg);
  }
}

// The check right before signing. Only a conflict says the address can't be trusted; a gone address sends
// the user back for a new one. A pause or the rate limit is named as such,
// and no answer leaves the user here to confirm again.
export function getBinanceDepositVerifyFailure(
  intl: IntlShape,
  code: number | undefined,
) {
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
