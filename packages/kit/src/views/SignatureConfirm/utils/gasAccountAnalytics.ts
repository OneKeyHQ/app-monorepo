import BigNumber from 'bignumber.js';

import type {
  IGasAccountAnalyticsContext,
  IGasAccountFiatBucket,
  IGasAccountShortageType,
} from '@onekeyhq/shared/src/logger/scopes/transaction/types';
import type {
  IGasAccountScenario,
  IGasPayer,
} from '@onekeyhq/shared/types/fee';

export function isGasSponsoredAnalyticsContext(
  context: IGasAccountAnalyticsContext | undefined,
): context is IGasAccountAnalyticsContext {
  return Boolean(
    context &&
    (context.selectedPayer === 'gasAccount' ||
      context.effectiveFeePayer === 'megafuel'),
  );
}

function toNonNegativeBigNumber(value: string | number | undefined) {
  const result = new BigNumber(value ?? 0);
  if (!result.isFinite() || result.isNegative()) {
    return new BigNumber(0);
  }
  return result;
}

function toOptionalNonNegativeBigNumber(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }
  const result = new BigNumber(value);
  if (!result.isFinite() || result.isNegative()) {
    return undefined;
  }
  return result;
}

export function getGasAccountFiatBucket(
  value: BigNumber | undefined,
): IGasAccountFiatBucket {
  if (!value?.isFinite() || value.isNegative()) {
    return 'unknown';
  }
  if (value.lt(0.01)) return 'lt_0_01';
  if (value.lt(0.1)) return '0_01_0_1';
  if (value.lt(1)) return '0_1_1';
  if (value.lt(5)) return '1_5';
  return 'gte_5';
}

export function buildGasAccountAnalyticsContext(params: {
  entryPoint: IGasAccountAnalyticsContext['entryPoint'];
  network: string;
  scenario: IGasAccountScenario | undefined;
  gasAccountRequested: boolean;
  gasAccountSupported: boolean | null;
  gasAccountEligible: boolean | null;
  selectedPayer: 'user' | 'gasAccount';
  effectiveFeePayer: IGasPayer;
  unavailableReason: string | undefined;
  estimatedGasNative: string | undefined;
  nativeBalance: string | undefined;
  nativePrincipal: string | undefined;
  extraFeeNative: string | undefined;
  nativeTokenPrice: string | number | undefined;
  fiatCurrency: string | undefined;
  tokenPrincipalInsufficient: boolean;
  quoteId: string | undefined;
  orderId?: string;
}): IGasAccountAnalyticsContext {
  const estimatedGasNative = toNonNegativeBigNumber(params.estimatedGasNative);
  const nativeBalance = toOptionalNonNegativeBigNumber(params.nativeBalance);
  const nativePrincipal = toNonNegativeBigNumber(params.nativePrincipal);
  const extraFeeNative = toNonNegativeBigNumber(params.extraFeeNative);
  const requiredBeforeGas = nativePrincipal.plus(extraFeeNative);
  const requiredWithGas = requiredBeforeGas.plus(estimatedGasNative);

  const nativePrincipalInsufficient = nativeBalance?.lt(nativePrincipal);
  const extraFeeInsufficient = Boolean(
    nativeBalance &&
    !nativePrincipalInsufficient &&
    nativeBalance.lt(requiredBeforeGas),
  );
  const networkFeeInsufficient = Boolean(
    nativeBalance &&
    !nativePrincipalInsufficient &&
    !extraFeeInsufficient &&
    nativeBalance.lt(requiredWithGas),
  );

  let shortageType: IGasAccountShortageType = nativeBalance
    ? 'none'
    : 'unknown';
  if (params.tokenPrincipalInsufficient && networkFeeInsufficient) {
    shortageType = 'mixed';
  } else if (params.tokenPrincipalInsufficient || nativePrincipalInsufficient) {
    shortageType = 'principal';
  } else if (extraFeeInsufficient) {
    shortageType = 'extraFee';
  } else if (networkFeeInsufficient) {
    shortageType = 'networkFee';
  }

  const remainingForGas = nativeBalance
    ? BigNumber.max(nativeBalance.minus(requiredBeforeGas), 0)
    : undefined;
  const gasShortfallNative = remainingForGas
    ? BigNumber.max(estimatedGasNative.minus(remainingForGas), 0)
    : undefined;
  const nativeTokenPrice = toNonNegativeBigNumber(params.nativeTokenPrice);
  const fiatValueAvailable = nativeTokenPrice.gt(0);
  const estimatedGasFiat = fiatValueAvailable
    ? estimatedGasNative.times(nativeTokenPrice)
    : undefined;
  const gasShortfallFiat =
    fiatValueAvailable && gasShortfallNative
      ? gasShortfallNative.times(nativeTokenPrice)
      : undefined;
  const nativeBalanceFiat =
    fiatValueAvailable && nativeBalance
      ? nativeBalance.times(nativeTokenPrice)
      : undefined;

  return {
    entryPoint: params.entryPoint,
    network: params.network,
    scenario: params.scenario,
    gasAccountRequested: params.gasAccountRequested,
    gasAccountSupported: params.gasAccountSupported,
    gasAccountEligible: params.gasAccountEligible,
    selectedPayer: params.selectedPayer,
    effectiveFeePayer: params.effectiveFeePayer,
    unavailableReason: params.unavailableReason,
    nativeBalanceAvailable: Boolean(nativeBalance),
    selfPayGasSufficient: nativeBalance
      ? nativeBalance.gte(requiredWithGas)
      : null,
    shortageType,
    estimatedGasNative: estimatedGasNative.toFixed(),
    estimatedGasFiat: estimatedGasFiat?.toFixed(),
    gasShortfallNative: gasShortfallNative?.toFixed(),
    gasShortfallFiat: gasShortfallFiat?.toFixed(),
    gasShortfallFiatBucket: getGasAccountFiatBucket(gasShortfallFiat),
    nativeBalanceFiatBucket: getGasAccountFiatBucket(nativeBalanceFiat),
    fiatCurrency: params.fiatCurrency,
    fiatValueAvailable,
    quoteId: params.quoteId,
    orderId: params.orderId,
  };
}
