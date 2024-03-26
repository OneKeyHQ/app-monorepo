import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  ESwapProviders,
  ESwapSlippageSegmentKey,
} from '@onekeyhq/shared/types/swap/types';
import type { ISwapFromAmountPercentageItem } from '@onekeyhq/shared/types/swap/types';

export const CrossChainSwapProviders = [
  ESwapProviders.SWFT,
  ESwapProviders.SOCKET_BRIDGE,
];
export const SingleChainSwapProviders = [
  ESwapProviders.ONE_INCH,
  ESwapProviders.ZERO_X,
];

export const swapFromAmountPercentageItems: ISwapFromAmountPercentageItem[] = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: 'Max', value: 1 },
];

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

export const socketBridgeScanUrl = 'https://socketscan.io/tx/';

export const networkTransactionExplorerReplaceStr = '{transaction}';

export const swapTokenCatchMapMaxCount = 30;

export const swapApproveResetValue = '0';

export const swapQuoteFetchInterval = timerUtils.getTimeDurationMs({
  seconds: 17,
});

export const swapNetworksCommonCount = 8;
export const swapNetworksCommonCountMD = 5;

export const swapRateDifferenceMax = -10;
export const swapRateDifferenceMin = 0.05;
