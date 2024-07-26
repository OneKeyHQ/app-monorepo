import type { IToken, ITokenData } from '@onekeyhq/shared/types/token';

export enum EAssetSelectorRoutes {
  TokenSelector = 'TokenSelector',
}

export type ITokenSelectorParamList = {
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
};

export type IAssetSelectorParamList = {
  [EAssetSelectorRoutes.TokenSelector]: ITokenSelectorParamList;
};
