import type {
  ENetworkStatus,
  INetworkPriceConfig,
  INetworkRpcURL,
} from '@onekeyhq/shared/types';

import type { IVaultSettings } from '../vaults/types';
import type { HasName } from './base';
import type { MessageDescriptor } from 'react-intl';

type NetworkBase = HasName & {
  impl: string;
  symbol: string;
  logoURI: string;
  enabled: boolean;
  feeSymbol: string;
  decimals: number;
  feeDecimals: number; // 1,000,000,000 -> 1 GWEI
  balance2FeeDecimals: number;
};

type PresetNetwork = NetworkBase & {
  chainId?: string;
  shortName: string;
  shortCode: string;
  isTestnet?: boolean;
  presetRpcURLs: Array<string>;
  rpcURLs?: INetworkRpcURL[];
  prices?: INetworkPriceConfig[];
  explorers?: Array<Record<string, any>>;
  extensions?: Record<string, any>;
  clientApi?: Record<string, string>;
  status: ENetworkStatus;
};

type DBNetwork = NetworkBase & {
  rpcURL: string;
  position: number;
  curve?: string;
  explorerURL?: string;
  clientApi?: Record<string, string>;
};

type EvmExtraInfo = {
  chainId: string;
  networkVersion: string;
};

type AccountNameInfo = {
  // because the first account path of ledger live template is the same as the bip44 account path, so we should set idSuffix to uniq them
  idSuffix?: string; // hd-1--m/44'/60'/0'/0/0--LedgerLive
  prefix: string; // accountNamePrefix: EVM #1, Ledger Live #2
  // addressPrefix?: string; // use presetNetworks.extensions.providerOptions.addressPrefix instead.
  category: string;
  template: string;
  coinType: string;
  label?:
    | {
        // LocaleIds
        id: MessageDescriptor['id'];
      }
    | string;
  desc?:
    | {
        // LocaleIds
        id: MessageDescriptor['id'];
        placeholder?: any;
      }
    | string;
  subDesc?: string;
  recommended?: boolean;
  notRecommended?: boolean;
  enableCondition?: {
    networkId?: string;
  };
};

type BlockExplorer = {
  name: string;
  address: string;
  block: string;
  transaction: string;
};

type Network = NetworkBase & {
  rpcURL: string;
  shortName: string;
  shortCode?: string;
  preset: boolean;
  isTestnet: boolean;
  // UI specific properties.
  // TODO: move this into remote config?
  nativeDisplayDecimals: number;
  tokenDisplayDecimals: number;
  // extra info for dapp interactions
  extraInfo: EvmExtraInfo | Record<string, any>;
  // extra info for building up account name
  accountNameInfo: Record<string, AccountNameInfo>;
  // TODO: rpcURLs
  blockExplorerURL: BlockExplorer;
  settings: IVaultSettings;
  clientApi?: Record<string, string>;
};

type AddEVMNetworkParams = {
  name: string;
  symbol?: string;
  rpcURL: string;
  explorerURL?: string;
  logoURI?: string;
};

type SwitchRpcParams = {
  name: string;
  rpcURL: string;
  logoURI?: string;
  networkId: string;
};

type AddNetworkParams = AddEVMNetworkParams;

type UpdateEVMNetworkParams = {
  name?: string;
  symbol?: string;
  rpcURL?: string;
  explorerURL?: string;
  logoURI?: string;
};

type UpdateNetworkParams = UpdateEVMNetworkParams;

type EIP1559Fee = {
  baseFee: string;

  maxPriorityFeePerGas: string; // in GWEI
  maxPriorityFeePerGasValue?: string;

  maxFeePerGas: string; // in GWEI
  maxFeePerGasValue?: string;

  gasPrice?: string; // in GWEI
  gasPriceValue?: string;

  confidence?: number;
  price?: string;
};

// metamask
enum NetworkCongestionThresholds {
  notBusy = 0,
  stable = 0.33,
  busy = 0.66,
}

export { NetworkCongestionThresholds };

export type {
  AccountNameInfo,
  AddEVMNetworkParams,
  AddNetworkParams,
  BlockExplorer,
  DBNetwork,
  EIP1559Fee,
  EvmExtraInfo,
  Network,
  PresetNetwork,
  SwitchRpcParams,
  UpdateNetworkParams,
};
