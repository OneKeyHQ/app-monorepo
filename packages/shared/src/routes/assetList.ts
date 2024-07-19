import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

export enum EModalAssetListRoutes {
  TokenList = 'TokenList',
}

export type IModalAssetListParamList = {
  [EModalAssetListRoutes.TokenList]: {
    accountId: string;
    networkId: string;
    walletId: string;
    tokenList: {
      tokens: IAccountToken[];
      keys: string;
      map: Record<string, ITokenFiat>;
    };
    title?: string;
    helpText?: string;
    isBlocked?: boolean;
    onPressToken?: (token: IAccountToken) => void;
    deriveInfo?: IAccountDeriveInfo;
    deriveType?: IAccountDeriveTypes;
    isAllNetworks?: boolean;
  };
};
