import BigNumber from 'bignumber.js';

import { FailedToEstimatedGasError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { ICustomPriorityFeeOverride } from '@onekeyhq/shared/src/utils/marketPresetFeeUtils';
import { applyCustomPriorityFeeToGasInfo } from '@onekeyhq/shared/src/utils/marketPresetFeeUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IGasEIP1559, IGasLegacy } from '@onekeyhq/shared/types/fee';
import type {
  IFetchQuoteResult,
  ISwapGasInfo,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function getEvmThorSwapGasLimit({
  networkId,
  swapInfo,
  isApprove,
}: {
  networkId: string;
  swapInfo?: ISwapTxInfo;
  isApprove?: boolean;
}) {
  if (
    isApprove ||
    !networkUtils.isEvmNetwork({ networkId }) ||
    !swapInfo?.swapBuildResData.thorSwapCallData
  ) {
    return undefined;
  }
  const limit = new BigNumber(swapInfo.swapBuildResData.result.gasLimit ?? 0);
  // The build response already includes the provider's gas buffer.
  return limit.isFinite() && limit.isGreaterThan(0)
    ? limit.integerValue(BigNumber.ROUND_CEIL).toFixed()
    : undefined;
}

export function applyEvmThorSwapGasLimit<
  T extends {
    gas?: IGasLegacy | IGasLegacy[];
    gasEIP1559?: IGasEIP1559 | IGasEIP1559[];
  } & Pick<ISwapGasInfo, 'payer' | 'gasAccountQuote' | 'megafuelEligible'>,
>({
  gasInfo,
  isSponsored,
  ...params
}: Parameters<typeof getEvmThorSwapGasLimit>[0] & {
  gasInfo: T;
  isSponsored?: boolean;
}): T {
  const gasLimit = getEvmThorSwapGasLimit(params);
  if (!gasLimit) {
    return gasInfo;
  }
  const legacyFees = Array.isArray(gasInfo.gas) ? gasInfo.gas : [gasInfo.gas];
  // Keep the estimate used by sponsorship. Some callers only retain MegaFuel's
  // zero-price fee tier, so preserve that tier even without the sponsor flags.
  if (
    isSponsored ??
    (gasInfo.payer === 'gasAccount' ||
      gasInfo.payer === 'megafuel' ||
      gasInfo.megafuelEligible?.sponsorable ||
      legacyFees.some(
        (fee) => fee?.originalGasPrice && new BigNumber(fee.gasPrice).isZero(),
      ))
  ) {
    return gasInfo;
  }
  const applyLimit = <G extends IGasLegacy | IGasEIP1559>(fee: G): G => ({
    ...fee,
    gasLimit,
    gasLimitForDisplay: gasLimit,
  });
  return {
    ...gasInfo,
    gas: Array.isArray(gasInfo.gas)
      ? gasInfo.gas.map(applyLimit)
      : gasInfo.gas && applyLimit(gasInfo.gas),
    gasEIP1559: Array.isArray(gasInfo.gasEIP1559)
      ? gasInfo.gasEIP1559.map(applyLimit)
      : gasInfo.gasEIP1559 && applyLimit(gasInfo.gasEIP1559),
  };
}

export async function resolveEvmThorSwapGasInfo({
  accountId,
  gasInfo,
  useDefaultRpc,
  customPriorityFee,
  ...params
}: Parameters<typeof getEvmThorSwapGasLimit>[0] & {
  accountId: string;
  gasInfo: ISwapGasInfo;
  useDefaultRpc?: boolean;
  customPriorityFee?: ICustomPriorityFeeOverride;
}): Promise<ISwapGasInfo> {
  if (
    params.isApprove ||
    !networkUtils.isEvmNetwork({ networkId: params.networkId }) ||
    !params.swapInfo?.swapBuildResData.thorSwapCallData
  ) {
    return gasInfo;
  }
  const isExternalAccount = accountUtils.isExternalAccount({ accountId });
  // A positive legacy price is paid by the user even if the estimate originally
  // offered MegaFuel. Gas Account uses normal prices and remains independent.
  const isPaidMegafuelOverride =
    !gasInfo.gasEIP1559 &&
    isSwapMegafuelSponsored(gasInfo) &&
    !isSwapGasAccountSponsored(gasInfo) &&
    new BigNumber(gasInfo.gas?.gasPrice ?? 0).isGreaterThan(0);
  const customRpcInfo =
    useDefaultRpc || isExternalAccount || isPaidMegafuelOverride
      ? undefined
      : await backgroundApiProxy.serviceCustomRpc.getCustomRpcForNetwork(
          params.networkId,
        );
  if (
    !isExternalAccount &&
    !isPaidMegafuelOverride &&
    (!customRpcInfo?.rpc || !customRpcInfo.enabled)
  ) {
    return applyEvmThorSwapGasLimit({ ...params, gasInfo });
  }

  let gas = gasInfo.gas;
  // External wallets and custom RPC broadcasts cannot honor sponsorship.
  // Preserve a selected nonzero custom price when restoring the regular price.
  if (
    gas &&
    new BigNumber(gas.gasPrice).isZero() &&
    (gas.originalGasPrice !== undefined || isSwapGasSponsored(gasInfo))
  ) {
    const originalGasPrice = new BigNumber(gas.originalGasPrice ?? Number.NaN);
    if (!originalGasPrice.isFinite() || !originalGasPrice.isGreaterThan(0)) {
      throw new FailedToEstimatedGasError();
    }
    gas = { ...gas, gasPrice: originalGasPrice.toFixed() };
  }
  const userPaidGasInfo: ISwapGasInfo = {
    ...gasInfo,
    gas,
    payer: 'user',
    megafuelEligible: undefined,
    gasAccountEligible: false,
    gasAccountQuote: undefined,
  };
  return applyEvmThorSwapGasLimit({
    ...params,
    isSponsored: false,
    // Apply the external wallet's selection after restoring the regular fee.
    gasInfo: isExternalAccount
      ? applyCustomPriorityFeeToGasInfo({
          gasInfo: userPaidGasInfo,
          customPriorityFee,
        })
      : userPaidGasInfo,
  });
}

export function isSwapMegafuelSponsored(gasInfo?: ISwapGasInfo) {
  return Boolean(
    gasInfo?.megafuelEligible?.sponsorable || gasInfo?.payer === 'megafuel',
  );
}

export function isSwapGasAccountSponsored(gasInfo?: ISwapGasInfo) {
  return Boolean(
    gasInfo?.gasAccountEligible &&
    gasInfo.payer === 'gasAccount' &&
    gasInfo.gasAccountQuote?.quoteId,
  );
}

export function isSwapGasSponsored(gasInfo?: ISwapGasInfo) {
  return Boolean(
    isSwapGasAccountSponsored(gasInfo) || isSwapMegafuelSponsored(gasInfo),
  );
}

/**
 * Whether the send step may reuse the gas estimated for the review instead of
 * re-estimating. A swap that requests Gas Account at send time always
 * re-estimates for a fresh quote. A cached Gas Account sponsorship must not be
 * reused once this send no longer requests it (for example a custom RPC was
 * enabled after the review): the stale quote would reach a broadcast that
 * cannot honor it, and the native balance precheck would skip the real fee.
 */
export function canReuseSwapReviewGasInfo({
  cachedGasInfo,
  needFetchGas,
  isGasAccountEnabled,
}: {
  cachedGasInfo?: ISwapGasInfo;
  needFetchGas?: boolean;
  isGasAccountEnabled: boolean;
}) {
  return Boolean(
    cachedGasInfo &&
    !needFetchGas &&
    !isGasAccountEnabled &&
    !isSwapGasAccountSponsored(cachedGasInfo),
  );
}

/**
 * Whether this swap may ask estimate-fee for Gas Account sponsorship
 * (OK-62562). The backend `gasAccountEnabled` flag on quote / build-tx is only
 * a provider-level pre-check; sponsorship is limited to a single swap tx
 * without approval, so any approve step in the same review (bundled approve
 * txs, or a quote whose allowance is still insufficient) opts out. The wallet
 * backend still decides the real eligibility from the estimate-fee call.
 */
export function isSwapGasAccountCandidate({
  swapInfo,
  quoteResult,
  hasApproveTx,
}: {
  swapInfo?: ISwapTxInfo;
  quoteResult?: IFetchQuoteResult;
  hasApproveTx?: boolean;
}) {
  const buildResult = swapInfo?.swapBuildResData?.result;
  if (!buildResult?.gasAccountEnabled || hasApproveTx) {
    return false;
  }
  return !quoteResult?.allowanceResult && !buildResult.allowanceResult;
}

/**
 * Whether the direct swap pipeline should request Gas Account sponsorship.
 * Besides the candidate rule above, the direct pipeline broadcasts through the
 * custom RPC when one is enabled (`signAndSendTransaction` without
 * `useDefaultRpc`), so a sponsor quote could never be honored there. Mirror
 * the confirm page, which suppresses sponsorship for `isCustomRpcEnabled`, by
 * not requesting it in the first place. If the lookup itself fails, fall back
 * to user-paid gas instead of failing the whole swap.
 */
export async function shouldRequestSwapGasAccount({
  networkId,
  swapInfo,
  quoteResult,
  hasApproveTx,
}: {
  networkId: string;
  swapInfo?: ISwapTxInfo;
  quoteResult?: IFetchQuoteResult;
  hasApproveTx?: boolean;
}) {
  if (!isSwapGasAccountCandidate({ swapInfo, quoteResult, hasApproveTx })) {
    return false;
  }
  try {
    const customRpcInfo =
      await backgroundApiProxy.serviceCustomRpc.getCustomRpcForNetwork(
        networkId,
      );
    return !(customRpcInfo?.rpc && customRpcInfo?.enabled);
  } catch {
    return false;
  }
}
