import type {
  IAccountDeriveInfoItems,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';

export enum EModalSignAndVerifyRoutes {
  SignAndVerifyMessage = 'SignAndVerifyMessage',
}

export type IModalSignAndVerifyParamList = {
  [EModalSignAndVerifyRoutes.SignAndVerifyMessage]?: {
    networkId?: string;
    accountId?: string;
    walletId?: string;
    indexedAccountId?: string;
    deriveInfoItems?: IAccountDeriveInfoItems[];
    deriveType?: IAccountDeriveTypes;
    isOthersWallet?: boolean;
    useHomeAccount?: boolean;
  };
};
