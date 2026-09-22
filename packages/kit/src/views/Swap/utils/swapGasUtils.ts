import type {
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
