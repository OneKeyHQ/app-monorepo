import BigNumber from 'bignumber.js';

import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  ISwapGasInfo,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

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

export function getEvmThorSwapGasLimit({
  networkId,
  buildTx,
  isSponsored,
}: {
  networkId: string;
  buildTx?: IFetchBuildTxResponse;
  isSponsored: boolean;
}) {
  const gasLimit = buildTx?.result.gasLimit;
  if (
    !networkUtils.isEvmNetwork({ networkId }) ||
    !buildTx?.thorSwapCallData ||
    typeof gasLimit !== 'number' ||
    !Number.isSafeInteger(gasLimit) ||
    gasLimit <= 0 ||
    isSponsored
  ) {
    return undefined;
  }
  return String(gasLimit);
}

export function applyEvmThorSwapGasLimit<T extends ISwapGasInfo>({
  networkId,
  buildTx,
  gasInfo,
  isSponsored = isSwapGasSponsored(gasInfo),
}: {
  networkId: string;
  buildTx?: IFetchBuildTxResponse;
  gasInfo: T;
  isSponsored?: boolean;
}): T {
  const gasLimit = getEvmThorSwapGasLimit({ networkId, buildTx, isSponsored });
  if (!gasLimit) {
    return gasInfo;
  }

  // The build-tx limit already includes the provider's safety margin.
  const applyGasLimit = <G extends { gasLimit: string }>(gas?: G) => {
    if (!gas || new BigNumber(gas.gasLimit).gte(gasLimit)) {
      return gas;
    }
    return {
      ...gas,
      gasLimit: String(gasLimit),
      gasLimitForDisplay: String(gasLimit),
    };
  };
  return {
    ...gasInfo,
    gas: applyGasLimit(gasInfo.gas),
    gasEIP1559: applyGasLimit(gasInfo.gasEIP1559),
  };
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
