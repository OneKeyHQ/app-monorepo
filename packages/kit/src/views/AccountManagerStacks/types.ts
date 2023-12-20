import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';

import type { IWalletAvatarProps } from './AccountSelectorStack/WalletList/WalletAvatar';
import type { AvatarImageProps } from 'tamagui';

export enum EAccountManagerStacksRoutes {
  AccountSelectorStack = 'AccountSelectorStack',
}

export type IAccountManagerStacksParamList = {
  [EAccountManagerStacksRoutes.AccountSelectorStack]: undefined;
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
