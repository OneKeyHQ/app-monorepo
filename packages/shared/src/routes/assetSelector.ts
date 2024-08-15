import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import type {
  IToken,
  ITokenData,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import type { INetworkAccount } from '../../types/account';
import type { EDeriveAddressActionType } from '../../types/address';

export enum EAssetSelectorRoutes {
  TokenSelector = 'TokenSelector',
  DeriveTypesAddressSelector = 'DeriveTypesAddressSelector',
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
};

export type IAssetSelectorParamList = {
  [EAssetSelectorRoutes.TokenSelector]: ITokenSelectorParamList;
  [EAssetSelectorRoutes.DeriveTypesAddressSelector]: IDeriveTypesAddressSelectorParams;
};
