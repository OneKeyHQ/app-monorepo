import type { EIP1559Fee } from './network';

export type BlockNativeGasInfo = {
  estimatedTransactionCount: number;
  baseFee: string;
  prices: EIP1559Fee[];
};

export type BlockNativeGasAPIResponse = {
  system: string;
  network: string;
  unit: string;
  maxPrice: number;
  currentBlockNumber: number;
  msSinceLastBlock: number;
  blockPrices: {
    blockNumber: number;
    estimatedTransactionCount: number;
    baseFeePerGas: number;
    estimatedPrices: {
      confidence: number;
      price: number;
      maxPriorityFeePerGas: number;
      maxFeePerGas: number;
    }[];
  }[];
};
