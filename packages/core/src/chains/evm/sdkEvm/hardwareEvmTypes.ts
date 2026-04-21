/**
 * Shared hardware EVM transaction types.
 *
 * These mirror the hardware SDK's EVMTransaction / EVMTransactionEIP1559
 * shapes so both CLI (CJS context, cannot import hd-core) and kit-bg
 * can use the same type definitions.
 *
 * Shapes are intentionally exhaustive (no index signature) — drift from
 * the SDK's schema surfaces as a TypeScript error instead of silently
 * typechecking.
 */

export interface IHardwareEvmTransaction {
  to: string;
  value: string;
  data: string;
  chainId: number;
  nonce: string; // 0x-prefixed hex
  gasLimit: string; // 0x-prefixed hex
  gasPrice: string;
  maxFeePerGas: undefined;
  maxPriorityFeePerGas: undefined;
}

export interface IHardwareEvmTransactionEIP1559 {
  to: string;
  value: string;
  data: string;
  chainId: number;
  nonce: string; // 0x-prefixed hex
  gasLimit: string; // 0x-prefixed hex
  gasPrice: undefined;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  accessList?: Array<{ address: string; storageKeys: string[] }>;
}
