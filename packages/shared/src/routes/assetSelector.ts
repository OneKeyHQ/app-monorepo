import type { IToken, ITokenData } from '@onekeyhq/shared/types/token';

export enum EAssetSelectorRoutes {
  TokenSelector = 'TokenSelector',
}

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
};

export type IAssetSelectorParamList = {
  [EAssetSelectorRoutes.TokenSelector]: ITokenSelectorParamList;
};
