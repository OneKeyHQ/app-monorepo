import BigNumber from 'bignumber.js';

import type {
  IDecodedTxExtraStarknet,
  IDecodedTxPrivacyStarknet,
} from '@onekeyhq/core/src/chains/starknet/types';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import type {
  EStrk20PrivateTxKind,
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

export function getStarknetPrivacyOperationTitle(
  kind: EStrk20PrivateTxKind,
): ETranslations | ETranslationsMock {
  return {
    register: ETranslationsMock.starknet_privacy_activation_title,
    deposit: ETranslations.privacy_balance_shield__action,
    transfer: ETranslationsMock.starknet_privacy_action_send_private,
    withdraw: ETranslations.privacy_balance_unshield__action,
  }[kind];
}

export function getStarknetHistoryOperationTitle(
  extraInfo: IDecodedTxExtraInfo | null | undefined,
): ETranslations | ETranslationsMock | undefined {
  const extra = extraInfo as IDecodedTxExtraStarknet | null | undefined;
  if (extra?.accountDeployment) {
    return ETranslationsMock.starknet_account_deploy_wallet;
  }
  const kind = extra?.privacy?.kind;
  if (kind && kind !== 'transfer')
    return getStarknetPrivacyOperationTitle(kind);
}

export function getStarknetPrivacyAmountError({
  amount,
  balance,
  decimals,
}: {
  amount: string;
  balance: string | undefined;
  decimals: number | undefined;
}): ETranslationsMock | undefined {
  if (
    decimals === undefined ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 255 ||
    balance === undefined
  ) {
    return ETranslationsMock.starknet_privacy_error_balance;
  }
  const available = new BigNumber(balance);
  if (!available.isFinite() || available.isNegative())
    return ETranslationsMock.starknet_privacy_error_balance;
  const value = new BigNumber(amount);
  if (!value.isFinite() || value.isLessThanOrEqualTo(0))
    return ETranslationsMock.starknet_privacy_amount_required;
  if (!value.shiftedBy(decimals).isInteger())
    return ETranslationsMock.starknet_privacy_amount_precision;
  if (value.isGreaterThan(balance))
    return ETranslationsMock.starknet_privacy_amount_exceeds_available;
  return undefined;
}

/**
 * Renders the sequencing cooldown estimate. Block time is an estimate, so the
 * output is deliberately coarse and never claims a deadline.
 */
export function formatStrk20Countdown(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '0s';
  }
  const seconds = Math.ceil(totalSeconds);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  if (minutes < 60) {
    return restSeconds === 0 ? `${minutes}m` : `${minutes}m ${restSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes === 0 ? `${hours}h` : `${hours}h ${restMinutes}m`;
}

/**
 * Reads the STRK20 privacy block `buildDecodedTx` copies onto
 * `decodedTx.extraInfo.privacy` (core/src/chains/starknet/types). This is the
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

export function getStarknetPrivacyBalanceDisplay({
  balances,
  tokenAddress,
  decimals,
  publicBalanceParsed,
}: {
  balances?: IStrk20PrivateBalances;
  tokenAddress: string;
  decimals?: number;
  publicBalanceParsed?: string;
}): { privateBalanceParsed?: string; totalBalanceParsed?: string } {
  if (!balances || decimals === undefined) {
    return {};
  }
  const normalizedAddress = `0x${tokenAddress.slice(2).toLowerCase().padStart(64, '0')}`;
  // A successful scan with no notes is zero; a missing or failed scan is unknown.
  const privateBalanceParsed = new BigNumber(
    balances.byToken[normalizedAddress] ?? '0',
  )
    .shiftedBy(-decimals)
    .toFixed();
  return {
    privateBalanceParsed,
    totalBalanceParsed:
      publicBalanceParsed === undefined
        ? undefined
        : new BigNumber(publicBalanceParsed)
            .plus(privateBalanceParsed)
            .toFixed(),
  };
}

export function isStarknetPrivacyHistoryVisible({
  extraInfo,
  mode,
}: {
  extraInfo: IDecodedTxExtraInfo | null | undefined;
  mode: 'public' | 'private';
}): boolean {
  const privacy = readStarknetPrivacyBlock(extraInfo);
  if (mode === 'private') {
    return !!privacy;
  }
  // Deposits and withdrawals move both balances; private transfers do not.
  return !privacy || privacy.kind === 'deposit' || privacy.kind === 'withdraw';
}
