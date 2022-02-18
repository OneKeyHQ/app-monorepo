import BigNumber from 'bignumber.js';

import { HasName } from './base';

type NetworkBase = HasName & {
  impl: string;
  symbol: string;
  logoURI: string;
  enabled: boolean;
};

type NetworkShort = NetworkBase & {
  // Simple version, used in basic listing.
  preset: boolean;
  // UI specific properties.
  // TODO: move this into remote config?
  nativeDisplayDecimals: number;
  tokenDisplayDecimals: number;
};

type NetworkCommon = NetworkBase & {
  feeSymbol: string;
  decimals: number;
  feeDecimals: number;
  balance2FeeDecimals: number;
};

type DBNetwork = NetworkCommon & {
  rpcURL: string;
  position: number;
  curve?: string;
};

type PresetNetwork = NetworkCommon & {
  chainId?: number;
  isTestnet?: boolean;
  presetRpcURLs: Array<string>;
  rpcURLs?: Array<Record<string, string>>;
  prices?: Array<Record<string, any>>;
  explorers?: Array<Record<string, any>>;
  extensions?: Record<string, any>;
};

type Network = NetworkShort & DBNetwork & PresetNetwork;

type AddEVMNetworkParams = {
  name: string;
  symbol?: string;
  rpcURL: string;
};

type AddNetworkParams = AddEVMNetworkParams;

type UpdateEVMNetworkParams = {
  name?: string;
  symbol?: string;
  rpcURL?: string;
};

type UpdateNetworkParams = UpdateEVMNetworkParams;

type EIP1559Fee = {
  baseFee: BigNumber;
  maxPriorityFeePerGas: BigNumber;
  maxFeePerGas: BigNumber;
};

export type {
  NetworkBase,
  NetworkShort,
  DBNetwork,
  PresetNetwork,
  Network,
  AddEVMNetworkParams,
  AddNetworkParams,
  UpdateNetworkParams,
  EIP1559Fee,
};
