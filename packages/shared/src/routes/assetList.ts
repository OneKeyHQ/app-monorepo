import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import type {
  IAccountToken,
  IAddCustomTokenRouteParams,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

export enum EModalAssetListRoutes {
  TokenList = 'TokenList',
  TokenManagerModal = 'TokenManagerModal',
  AddCustomTokenModal = 'AddCustomTokenModal',
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
    helpText?: string | string[];
    isBlocked?: boolean;
    onPressToken?: (token: IAccountToken) => void;
    deriveInfo?: IAccountDeriveInfo;
    deriveType?: IAccountDeriveTypes;
    isAllNetworks?: boolean;
  };
  [EModalAssetListRoutes.TokenManagerModal]: {
    walletId: string;
    isOthersWallet?: boolean;
    indexedAccountId?: string;
    accountId: string;
    networkId: string;
    deriveType: IAccountDeriveTypes;
    isAllNetworks?: boolean;
  };
  [EModalAssetListRoutes.AddCustomTokenModal]: IAddCustomTokenRouteParams;
};
