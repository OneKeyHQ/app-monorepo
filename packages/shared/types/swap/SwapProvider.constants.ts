import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

export const swapSlippageItems: {
  key: ESwapSlippageSegmentKey;
  value: ESwapSlippageSegmentKey;
}[] = [
  { key: ESwapSlippageSegmentKey.AUTO, value: ESwapSlippageSegmentKey.AUTO },
  {
    key: ESwapSlippageSegmentKey.CUSTOM,
    value: ESwapSlippageSegmentKey.CUSTOM,
  },
];

export const swapSlippageAutoValue = 0.5;

export const swapSlippageMaxValue = 50;

export const swapSlippageWillFailMinValue = 0.1;

export const swapSlippageWillAheadMinValue = 5;

export const swapSlippage = 50;

export const networkTransactionExplorerReplaceStr = '{transaction}';

export const swapTokenCatchMapMaxCount = 30;

export const swapApproveResetValue = '0';

export const swapQuoteFetchInterval = timerUtils.getTimeDurationMs({
  seconds: 20,
});
export const swapQuoteSilenceFetchInterval = timerUtils.getTimeDurationMs({
  seconds: 10,
});

export const swapNetworksCommonCount = 8;
export const swapNetworksCommonCountMD = 5;

export const swapRateDifferenceMax = -10;
export const swapRateDifferenceMin = 0.05;

export enum ESwapProviderSort {
  RECOMMENDED = 'recommended',
  GAS_FEE = 'gasFee',
  SWAP_DURATION = 'swapDuration',
  RECEIVED = 'received',
}
