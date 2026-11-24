import BigNumber from 'bignumber.js';

import type { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { starknetPrivacyOperationTitles } from '@onekeyhq/shared/src/locale/starknetPrivacy';
import type {
  IDecodedTxExtraStarknet,
  IDecodedTxPrivacyStarknet,
  IStrk20PrivateBalances,
} from '@onekeyhq/shared/types/starknetPrivacy';
import type { IDecodedTxExtraInfo } from '@onekeyhq/shared/types/tx';

import type { IntlShape } from 'react-intl';

/**
 * `ETranslationsMock` ids are the English copy itself and are absent from the
 * message catalog, so react-intl only interpolates ICU placeholders when the
 * same string is also handed over as `defaultMessage`. A real `ETranslations`
 * id is already in the catalog, so the `defaultMessage` fallback is simply
 * unused for it; accepting both lets this format `mapStrk20Error`'s
 * `translationKey` without a branch.
 */
export function formatMockMessage(
  intl: IntlShape,
  id: ETranslations | ETranslationsMock,
  values?: Record<string, string | number>,
): string {
  return intl.formatMessage({ id, defaultMessage: id }, values);
}

export function getStarknetHistoryOperationTitle(
  extraInfo: IDecodedTxExtraInfo | null | undefined,
  options?: { isReceive?: boolean },
): ETranslations | ETranslationsMock | undefined {
  const extra = extraInfo as IDecodedTxExtraStarknet | null | undefined;
  if (extra?.accountDeployment) {
    return ETranslations.starknet_account_activation__title;
  }
  const kind = extra?.privacy?.kind;
  if (!kind) return undefined;
  if (kind === 'transfer' && options?.isReceive) return undefined;
  return starknetPrivacyOperationTitles[kind];
}

export function getStarknetPrivacyAmountError({
  amount,
  balance,
  decimals,
}: {
  amount: string;
  balance: string | undefined;
  decimals: number | undefined;
}): ETranslations | undefined {
  if (
    decimals === undefined ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 255 ||
    balance === undefined
  ) {
    return ETranslations.privacy_balance_unavailable__msg;
  }
  const available = new BigNumber(balance);
  if (!available.isFinite() || available.isNegative())
    return ETranslations.privacy_balance_unavailable__msg;
  const value = new BigNumber(amount);
  if (!value.isFinite() || value.isLessThanOrEqualTo(0))
    return ETranslations.defi_action_invalid_amount__msg;
  if (!value.shiftedBy(decimals).isInteger())
    return ETranslations.wallet_bulk_send_error_max_decimal_places;
  if (value.isGreaterThan(balance))
    return ETranslations.swap_page_button_insufficient_balance;
  return undefined;
}

/**
 * Reads the STRK20 privacy block `buildDecodedTx` copies onto
 * `decodedTx.extraInfo.privacy`. This is the
 * confirm screen's only source of display data for the block; the encodedTx
 * carries the build-time payload (proof, proofFacts, ...), not this.
 */
export function readStarknetPrivacyBlock(
  extraInfo: IDecodedTxExtraInfo | null | undefined,
): IDecodedTxPrivacyStarknet | undefined {
  return (extraInfo as IDecodedTxExtraStarknet | null | undefined)?.privacy;
}

export function getStarknetPrivacyFeeDisplay({
  extraInfos,
  decimals,
  networkFeeNative,
  nativeTokenPrice,
}: {
  extraInfos: (IDecodedTxExtraInfo | null | undefined)[];
  decimals?: number;
  networkFeeNative?: string;
  nativeTokenPrice?: number;
}) {
  if (decimals === undefined) return undefined;
  const protocolFees = extraInfos
    .map((extraInfo) => readStarknetPrivacyBlock(extraInfo)?.protocolFee)
    .filter((fee) => fee !== undefined);
  if (!protocolFees.length) return undefined;
  const protocolFee = BigNumber.sum(...protocolFees);
  if (!protocolFee.isFinite() || protocolFee.isNegative()) return undefined;
  const protocolFeeNative = protocolFee.shiftedBy(-decimals).toFixed();
  const networkFee = new BigNumber(networkFeeNative ?? NaN);
  const hasNetworkFee = networkFee.isFinite() && !networkFee.isNegative();
  const totalNative = hasNetworkFee
    ? networkFee.plus(protocolFeeNative).toFixed()
    : undefined;
  return {
    totalNative,
    totalFiat:
      totalNative !== undefined &&
      nativeTokenPrice !== undefined &&
      nativeTokenPrice > 0
        ? new BigNumber(totalNative).times(nativeTokenPrice).toFixed()
        : undefined,
  };
}

export function getStarknetPrivateBalanceParsed({
  balances,
  tokenAddress,
  decimals,
}: {
  balances?: IStrk20PrivateBalances;
  tokenAddress: string;
  decimals?: number;
}): string | undefined {
  if (!balances || decimals === undefined) {
    return undefined;
  }
  const normalizedAddress = `0x${tokenAddress.slice(2).toLowerCase().padStart(64, '0')}`;
  // A successful scan with no notes is zero; a missing or failed scan is unknown.
  return new BigNumber(balances.byToken[normalizedAddress] ?? '0')
    .shiftedBy(-decimals)
    .toFixed();
}

export function isStarknetPublicHistoryVisible(
  extraInfo: IDecodedTxExtraInfo | null | undefined,
): boolean {
  const privacy = readStarknetPrivacyBlock(extraInfo);
  // Deposits and withdrawals move both balances; private transfers do not.
  return !privacy || privacy.kind === 'deposit' || privacy.kind === 'withdraw';
}
