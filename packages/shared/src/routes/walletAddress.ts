import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';

import type { INetworkAccount } from '../../types/account';
import type { EDeriveAddressActionType } from '../../types/address';

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
    actionType?: EDeriveAddressActionType;
    onSelected?: ({
      account,
      deriveInfo,
      deriveType,
    }: {
      account: INetworkAccount;
      deriveInfo: IAccountDeriveInfo;
      deriveType: IAccountDeriveTypes;
    }) => void;
    onUnmounted?: () => void;
  };
  [EModalWalletAddressRoutes.WalletAddress]: {
    accountId?: string;
    indexedAccountId: string;
    walletId: string;
  };
};
