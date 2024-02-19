import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { ESwapProviders, ESwapSlippageSegmentKey } from '../types';

import type {
  ISwapFromAmountPercentageItem,
  ISwapSlippageSegmentItem,
} from '../types';

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

export const swapSlippageItems: ISwapSlippageSegmentItem[] = [
  { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
  { key: ESwapSlippageSegmentKey.ZERO_ONE, value: 0.1 },
  { key: ESwapSlippageSegmentKey.ZERO_FIVE, value: 0.5 },
  { key: ESwapSlippageSegmentKey.ONE, value: 1 },
];

export const socketBridgeScanUrl = 'https://socketscan.io/tx/';

export const networkTransactionExplorerReplaceStr = '{transaction}';

export const swapTokenCatchMapMaxCount = 30;

export const swapApproveResetValue = '0';

export const swapQuoteFetchInterval = timerUtils.getTimeDurationMs({
  seconds: 10,
});
