import type { IToken, ITokenData } from '@onekeyhq/shared/types/token';

export enum EAssetSelectorRoutes {
  TokenSelector = 'TokenSelector',
}

export type IAssetSelectorParamList = {
  [EAssetSelectorRoutes.TokenSelector]: {
    networkId: string;
    accountId: string;
    tokens?: ITokenData;
    networkName?: string;
    onSelect: (token: IToken) => void | Promise<void>;
    closeAfterSelect?: boolean;
  };
};
