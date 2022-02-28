import { HasName } from './base';

type NetworkBase = HasName & {
  impl: string;
  symbol: string;
  logoURI: string;
  enabled: boolean;
  feeSymbol: string;
  decimals: number;
  feeDecimals: number;
  balance2FeeDecimals: number;
};

type PresetNetwork = NetworkBase & {
  chainId?: number;
  shortName: string;
  isTestnet?: boolean;
  presetRpcURLs: Array<string>;
  rpcURLs?: Array<Record<string, string>>;
  prices?: Array<Record<string, any>>;
  explorers?: Array<Record<string, any>>;
  extensions?: Record<string, any>;
};

type DBNetwork = NetworkBase & {
  rpcURL: string;
  position: number;
  curve?: string;
};

type EvmExtraInfo = {
  chainId: string;
  networkVersion: string;
};

type BlockExplorer = {
  address: string;
  block: string;
  transaction: string;
};

type Network = NetworkBase & {
  rpcURL: string;
  shortName: string;
  preset: boolean;
  isTestnet: boolean;
  // UI specific properties.
  // TODO: move this into remote config?
  nativeDisplayDecimals: number;
  tokenDisplayDecimals: number;
  // extra info for dapp interactions
  extraInfo: EvmExtraInfo | Record<string, any>;
  // TODO: rpcURLs
  blockExplorerURL: BlockExplorer;
};

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
  baseFee: string;
  maxPriorityFeePerGas: string;
  maxFeePerGas: string;
};

export type {
  DBNetwork,
  PresetNetwork,
  Network,
  EvmExtraInfo,
  BlockExplorer,
  AddEVMNetworkParams,
  AddNetworkParams,
  UpdateNetworkParams,
  EIP1559Fee,
};
