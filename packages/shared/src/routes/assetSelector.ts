import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import type {
  IAccountToken,
  IAggregateToken,
  IToken,
  ITokenData,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import type { EModalReceiveRoutes } from './receive';
import type { EModalSignatureConfirmRoutes } from './signatureConfirm';
import type { INetworkAccount } from '../../types/account';
import type { EDeriveAddressActionType } from '../../types/address';

export enum EAssetSelectorRoutes {
  TokenSelector = 'TokenSelector',
  DeriveTypesAddressSelector = 'DeriveTypesAddressSelector',
  AggregateTokenSelector = 'AggregateTokenSelector',
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

export type ITokenSelectorParamList = {
  title?: string;
  networkId: string;
  accountId: string;
  indexedAccountId?: string;
  activeAccountId?: string;
  activeNetworkId?: string;
  tokens?: ITokenData;
  onSelect: (token: IToken) => void | Promise<void>;
  closeAfterSelect?: boolean;
  tokenListState?: {
    isRefreshing: boolean;
    initialized: boolean;
  };
  searchAll?: boolean;
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
};

export type IAggregateTokenSelectorParams = {
  title?: string;
  searchPlaceholder?: string;
  accountId: string;
  indexedAccountId?: string;
  aggregateToken: IAccountToken;
  allAggregateTokenList?: IAccountToken[];
  onSelect: (token: IAccountToken) => void | Promise<void>;
  closeAfterSelect?: boolean;
  enableNetworkAfterSelect?: boolean;
  hideZeroBalanceTokens?: boolean;
};

export type IAssetSelectorParamList = {
  [EAssetSelectorRoutes.TokenSelector]: ITokenSelectorParamList;
  [EAssetSelectorRoutes.DeriveTypesAddressSelector]: IDeriveTypesAddressSelectorParams;
  [EAssetSelectorRoutes.AggregateTokenSelector]: IAggregateTokenSelectorParams;
};
