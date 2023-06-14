import type { EIP1559Fee } from './network';

export type IGasInfo = {
  prices: Array<string | EIP1559Fee>;
  networkCongestion?: number;
  estimatedTransactionCount?: number;
};
