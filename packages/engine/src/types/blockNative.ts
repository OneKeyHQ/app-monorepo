import type { EIP1559Fee } from './network';

export type BlockNativeGasInfo = {
  estimatedTransactionCount: number;
  baseFee: string;
  prices: EIP1559Fee[];
  maxPrice: number;
  unit: string;
};

export type EstimatedPrice = {
  confidence: number;
  price: number;
  maxPriorityFeePerGas: number;
  maxFeePerGas: number;
};

export type BlockPrice = {
  blockNumber: number;
  estimatedTransactionCount: number;
  baseFeePerGas: number;
  estimatedPrices: EstimatedPrice[];
};

export type BlockNativeGasAPIResponse = {
  system: string;
  network: string;
  unit: string;
  maxPrice: number;
  currentBlockNumber: number;
  msSinceLastBlock: number;
  blockPrices: BlockPrice[];
};
