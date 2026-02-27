import type {
  IAccountDeriveInfoItems,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';

export enum EModalSignAndVerifyRoutes {
  SignAndVerifyMessage = 'SignAndVerifyMessage',
}

export type IModalSignAndVerifyParamList = {
  [EModalSignAndVerifyRoutes.SignAndVerifyMessage]: {
    networkId: string;
    accountId: string | undefined;
    walletId: string | undefined;
    indexedAccountId: string | undefined;
    deriveInfoItems: IAccountDeriveInfoItems[];
    deriveType: IAccountDeriveTypes | undefined;
    isOthersWallet: boolean | undefined;
  };
};
