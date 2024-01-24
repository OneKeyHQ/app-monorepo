import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';

import type { IWalletAvatarProps } from '../../../components/WalletAvatar';
import type { IAccountSelectorRouteParams } from '../../../states/jotai/contexts/accountSelector';
import type { AvatarImageProps } from 'tamagui';

export enum EAccountManagerStacksRoutes {
  AccountSelectorStack = 'AccountSelectorStack',
}

export type IAccountManagerStacksParamList = {
  [EAccountManagerStacksRoutes.AccountSelectorStack]: IAccountSelectorRouteParams;
};

export type IAccountProps = {
  id: string;
  name: string;
  networkImageSrc?: AvatarImageProps['src'];
  address?: string;
  evmAddress?: string;
};

export type IAccountGroupProps = {
  title?: string;
  isHiddenWalletData?: boolean;
  emptyText?: string;
  walletId: string;
  data: IDBIndexedAccount[];
};

export type IWalletProps = {
  id: string;
  img: IWalletAvatarProps['img'];
  status?: 'default' | 'connected';
  type?: 'hd' | 'hw' | 'others';
  name: string;
  accounts: IAccountGroupProps[];
};
