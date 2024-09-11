import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';

import type { INetworkAccount } from '../../types/account';
import type { EDeriveAddressActionType } from '../../types/address';
import type { IToken, ITokenFiat } from '../../types/token';

export enum EModalWalletAddressRoutes {
  DeriveTypesAddress = 'DeriveTypesAddress',
  WalletAddress = 'WalletAddress',
}

export type IDeriveTypesAddressParams = {
  networkId: string;
  indexedAccountId: string;
  actionType?: EDeriveAddressActionType;
  token?: IToken;
  tokenMap?: Record<string, ITokenFiat>;
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

export type IModalWalletAddressParamList = {
  [EModalWalletAddressRoutes.DeriveTypesAddress]: IDeriveTypesAddressParams;
  [EModalWalletAddressRoutes.WalletAddress]: {
    accountId?: string;
    walletId?: string;
    indexedAccountId: string;
  };
};
