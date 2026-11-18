import type {
  IAccountSelectorAvailableNetworks,
  IAccountSelectorRouteParams,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import type { ITokenSelectorParamList } from './assetSelector';

export enum EChainSelectorPages {
  AccountChainSelector = 'AccountChainSelector',
  ChainSelector = 'ChainSelector',
  AddCustomNetwork = 'AddCustomNetwork',
  ChainListSearch = 'ChainListSearch',
  AllNetworksManager = 'AllNetworksManager',
  MultiNetworkSelector = 'MultiNetworkSelector',
  TokenSelector = 'TokenSelector',
  UnifiedNetworkSelector = 'UnifiedNetworkSelector',
}
export type IAccountChainSelectorRouteParams = IAccountSelectorRouteParams &
  IAccountSelectorAvailableNetworks & {
    editable?: boolean;
    recentNetworksEnabled?: boolean;
    recordNetworkHistoryEnabled?: boolean;
  };

export type IUnifiedNetworkSelectorRouteParams = IAccountSelectorRouteParams &
  IAccountSelectorAvailableNetworks & {
    editable?: boolean;
    recordNetworkHistoryEnabled?: boolean;
    // From AllNetworksManager
    onNetworksChanged?: () => Promise<void>;
    // New
    defaultTab?: 'portfolio' | 'network';
  };

export type IChainSelectorParams = {
  defaultNetworkId?: string;
  networkIds?: string[];
  title?: string;
  onSelect?: (network: IServerNetwork) => void;
  disableNetworkIds?: string[];
  grouped?: boolean;
  excludeAllNetworkItem?: boolean;
  closeAfterSelect?: boolean;
  showNetworkValues?: boolean;
  hideLowValueNetworkValue?: boolean;
  indexedAccountId?: string;
  accountId?: string;
  // Per-network values the caller already holds (e.g. Dust sweep's balances),
  // shown and sorted like account values without reading the account cache.
  networkValues?: Record<string, string>;
  networkValueCurrency?: string;
  // Grouped list only: lift valued networks into a top "Networks with assets"
  // section like the wallet network selector, instead of A-Z only.
  groupByNetworkValue?: boolean;
  recentNetworksEnabled?: boolean;
  // Grouped list only: mark the current network with a row background, like
  // the wallet network selector, instead of a check mark.
  highlightSelected?: boolean;
  featuredNetwork?: {
    networkId: string;
    badgeText: string;
    disabled?: boolean;
  };
};

export type IMultiNetworkSelectorAlert = {
  icon?: string;
  title?: string;
  description?: string;
};

export type IMultiNetworkSelectorRouteParams = {
  title?: string;
  searchPlaceholder?: string;
  selectAllLabel?: string;
  cancelButtonText?: string;
  confirmButtonText?: string;
  emptyText?: string;
  networkIds: string[];
  selectedNetworkIds: string[];
  networkSubtitleMap?: Record<string, string | undefined>;
  topAlert?: IMultiNetworkSelectorAlert;
  onSelectedNetworkIdsChange?: (networkIds: string[]) => void;
};

export type IChainSelectorParamList = {
  [EChainSelectorPages.TokenSelector]: ITokenSelectorParamList;
  [EChainSelectorPages.AccountChainSelector]: IAccountChainSelectorRouteParams;
  [EChainSelectorPages.ChainSelector]?: IChainSelectorParams;
  [EChainSelectorPages.MultiNetworkSelector]: IMultiNetworkSelectorRouteParams;
  [EChainSelectorPages.UnifiedNetworkSelector]: IUnifiedNetworkSelectorRouteParams;
  [EChainSelectorPages.ChainListSearch]: {
    onSuccess?: (network: IServerNetwork) => void;
  };
  [EChainSelectorPages.AddCustomNetwork]: {
    state: 'add' | 'edit';
    networkId?: string;
    networkName?: string;
    rpcUrl?: string;
    chainId?: number;
    symbol?: string;
    blockExplorerUrl?: string;
    onSuccess?: (network: IServerNetwork) => void;
    onDeleteSuccess?: () => void;
  };
  [EChainSelectorPages.AllNetworksManager]: {
    walletId: string;
    accountId?: string;
    indexedAccountId?: string;
    onNetworksChanged?: () => Promise<void>;
  };
};
