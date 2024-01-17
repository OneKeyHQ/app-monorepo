import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

export enum EModalAssetListRoutes {
  TokenList = 'TokenList',
}

export type IModalAssetListParamList = {
  [EModalAssetListRoutes.TokenList]: {
    accountId: string;
    networkId: string;
    tokenList: {
      tokens: IAccountToken[];
      keys: string;
      map: Record<string, ITokenFiat>;
    };
    title?: string;
    helpText?: string;
    onPressToken?: (token: IAccountToken) => void;
  };
};
