/* cspell:ignore Infini */

import type { ReactNode } from 'react';

import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import type { IExchangeFilter } from '@onekeyhq/shared/types/exchange';
import type { IPrimeInfiniPaymentAsset } from '@onekeyhq/shared/types/prime/primeTypes';
import type {
  IAccountToken,
  IToken,
  ITokenData,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import type { EModalReceiveRoutes } from './receive';
import type { EModalSignatureConfirmRoutes } from './signatureConfirm';
import type { IServerNetwork } from '../../types';
import type { INetworkAccount } from '../../types/account';
import type { EDeriveAddressActionType } from '../../types/address';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export enum EAssetSelectorRoutes {
  TokenSelector = 'TokenSelector',
  DeriveTypesAddressSelector = 'DeriveTypesAddressSelector',
  AggregateTokenSelector = 'AggregateTokenSelector',
  PrimeInfiniPaymentAssetSelector = 'PrimeInfiniPaymentAssetSelector',
}

export type IDeriveTypesAddressSelectorParams = {
  networkId: string;
  indexedAccountId: string;
  actionType?: EDeriveAddressActionType;
  token?: IToken;
  tokenMap?: Record<string, ITokenFiat>;
  onSelected?: ({
    account,
    deriveInfo,
    deriveType,
  }: {
    account: INetworkAccount;
    deriveInfo: IAccountDeriveInfo;
    deriveType: IAccountDeriveTypes;
  }) => void;
  onUnmounted?: () => void;
};

// Multi-chain context handed back with a selection so the receiving page can
// offer an in-page network switch without re-deriving the member list.
export type IAggregateTokenSelectContext = {
  aggregateToken?: IAccountToken;
  aggregateSubTokenList?: IAccountToken[];
  allAggregateTokenList?: IAccountToken[];
  network?: IServerNetwork;
  // The row created the address on the way (analytics).
  createdAddress?: boolean;
};

export type ITokenSelectorParamList = {
  title?: string;
  networkId: string;
  accountId: string;
  indexedAccountId?: string;
  activeAccountId?: string;
  activeNetworkId?: string;
  forceShowActiveAccountTokenList?: boolean;
  tokens?: ITokenData;
  onSelect: (
    token: IToken,
    context?: IAggregateTokenSelectContext,
  ) => void | Promise<void>;
  closeAfterSelect?: boolean;
  tokenListState?: {
    isRefreshing: boolean;
    initialized: boolean;
  };
  searchAll?: boolean;
  // Main Receive only: search across all networks under a single-network scope
  // and group results into current-network / other-networks sections.
  enableCrossNetworkSearch?: boolean;
  // Overrides the browse-state (no search) empty title. Callers whose flow
  // does not care about holdings (Receive) set this so the shared selector
  // never shows the Send-semantics "You don't hold any crypto" copy.
  browseEmptyTitle?: string;
  isAllNetworks?: boolean;
  searchPlaceholder?: string;
  footerTipText?: string;
  aggregateTokenSelectorScreen?:
    | EModalReceiveRoutes.ReceiveSelectAggregateToken
    | EAssetSelectorRoutes.AggregateTokenSelector
    | EModalSignatureConfirmRoutes.TxSelectAggregateToken;
  allAggregateTokenMap?: Record<
    string,
    {
      tokens: IAccountToken[];
    }
  >;
  allAggregateTokens?: IAccountToken[];
  hideZeroBalanceTokens?: boolean;
  keepDefaultZeroBalanceTokens?: boolean;
  enableNetworkAfterSelect?: boolean;
  exchangeFilter?: IExchangeFilter;
  hideBalanceAndValue?: boolean;
  onSwitchNetwork?: () => void | Promise<void>;
  showDeFiTokenSwitch?: boolean;
  // Keeps DeFi (dApp receipt) tokens out of the browse list without offering
  // the switch; search still matches them. Receive uses it: such a token
  // arrives at the same address as any other token on its network, so the
  // list needs no second dataset.
  hideDeFiTokens?: boolean;
  // Optional second body segment next to the token list (main Receive uses
  // it for the network list). When set, the header carries only the title
  // and the body renders a segment control + search box above the content;
  // the search text is shared across segments.
  secondaryTab?: ITokenSelectorSecondaryTab;
};

// Props the selector hands to the secondary content so it scrolls under the
// collapsing header the same way the token list does.
export type ITokenSelectorSecondaryTabListProps = {
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
  contentContainerStyle: { pt: number };
};

export type ITokenSelectorSecondaryTab = {
  tokensTabLabel: string;
  label: string;
  searchPlaceholder: string;
  testIDs?: {
    segment?: string;
    tokensTab?: string;
    secondaryTab?: string;
    searchBar?: string;
  };
  renderContent: (
    searchKey: string,
    listProps: ITokenSelectorSecondaryTabListProps,
  ) => ReactNode;
  // Fired on a real change only (not on the initial render).
  onTabChange?: (params: { toSecondary: boolean }) => void;
};

export type IAggregateTokenSelectorParams = {
  title?: string;
  searchPlaceholder?: string;
  accountId: string;
  indexedAccountId?: string;
  aggregateToken: IAccountToken;
  // The owned sub-tokens for this `aggregateToken.$key`, passed by TokenSelector
  // when navigating in so AggregateTokenSelector no longer reads
  // `aggregateTokensListMapAtom` (tokenList cells full-delete plan, PR-3).
  // Optional to preserve type-compat for existing callers and as a defensive
  // fallback for any future direct entry.
  aggregateSubTokenList?: IAccountToken[];
  allAggregateTokenList?: IAccountToken[];
  onSelect: (
    token: IAccountToken,
    context?: IAggregateTokenSelectContext,
  ) => void | Promise<void>;
  closeAfterSelect?: boolean;
  enableNetworkAfterSelect?: boolean;
  hideZeroBalanceTokens?: boolean;
  exchangeFilter?: IExchangeFilter;
  hideBalanceAndValue?: boolean;
};

export type IPrimeInfiniPaymentAssetSelectorParams = {
  assets: IPrimeInfiniPaymentAsset[];
  selectedAssetKey: string;
  accountId?: string;
  indexedAccountId?: string;
  accountNetworkId?: string;
  onSelect: (assetKey: string) => void;
};

export type IAssetSelectorParamList = {
  [EAssetSelectorRoutes.TokenSelector]: ITokenSelectorParamList;
  [EAssetSelectorRoutes.DeriveTypesAddressSelector]: IDeriveTypesAddressSelectorParams;
  [EAssetSelectorRoutes.AggregateTokenSelector]: IAggregateTokenSelectorParams;
  [EAssetSelectorRoutes.PrimeInfiniPaymentAssetSelector]: IPrimeInfiniPaymentAssetSelectorParams;
};
