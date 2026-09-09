import type { ISwapGasInfo } from '@onekeyhq/shared/types/swap/types';

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
