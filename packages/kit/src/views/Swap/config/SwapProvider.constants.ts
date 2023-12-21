import { ESwapProviders } from '../types';

import type { ISwapFromAmountPercentageItem } from '../types';

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
