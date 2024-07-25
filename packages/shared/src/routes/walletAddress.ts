import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';

export enum EModalWalletAddressRoutes {
  DeriveTypesAddress = 'DeriveTypesAddress',
  WalletAddress = 'WalletAddress',
}

export type IModalWalletAddressParamList = {
  [EModalWalletAddressRoutes.DeriveTypesAddress]: {
    networkId: string;
    indexedAccountId: string;
    walletId: string;
    accountId: string;
    onUnmounted?: () => void;
  };
  [EModalWalletAddressRoutes.WalletAddress]: {
    accountId?: string;
    indexedAccountId: string;
    walletId: string;
    deriveType: IAccountDeriveTypes;
    deriveInfo: IAccountDeriveInfo;
  };
};
