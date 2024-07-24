import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';

export enum EModalWalletAddressRoutes {
  DeriveTypesAddress = 'DeriveTypesAddress',
  WalletAddress = 'WalletAddress',
}

export type IModalWalletAddressParamList = {
  [EModalWalletAddressRoutes.DeriveTypesAddress]: {
    networkId: string;
    accountId: string;
  };
  [EModalWalletAddressRoutes.WalletAddress]: {
    accountId: string;
    indexedAccountId: string;
    walletId: string;
    deriveType: IAccountDeriveTypes;
  };
};
