import type { EIP1559Fee } from './network';

export type MetaMaskEIP1559Fee = {
  suggestedMaxPriorityFeePerGas: string;
  suggestedMaxFeePerGas: string;
  minWaitTimeEstimate: number;
  maxWaitTimeEstimate: number;
};

export type MetaMaskGasAPIResponse = {
  error?: string;
  baseFeeTrend: string;
  estimatedBaseFee: string;
  high: MetaMaskEIP1559Fee;
  low: MetaMaskEIP1559Fee;
  medium: MetaMaskEIP1559Fee;
  networkCongestion: number;
  priorityFeeTrend: string;
};

export type MetaMaskGasInfo = {
  baseFee: string;
  prices: EIP1559Fee[];
  networkCongestion: number;
};
