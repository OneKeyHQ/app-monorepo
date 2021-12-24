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
};

type PresetNetwork = NetworkCommon & {
  presetRpcURLs: Array<string>;
  // TODO explorerURL
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

export type {
  NetworkBase,
  NetworkShort,
  DBNetwork,
  PresetNetwork,
  Network,
  AddEVMNetworkParams,
  AddNetworkParams,
  UpdateNetworkParams,
};
