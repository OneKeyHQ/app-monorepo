import type { IWalletAvatarProps } from './SelectorStack/WalletList/WalletAvatar';
import type { AvatarImageProps } from 'tamagui';

export enum EAccountManagerStacksRoutes {
  SelectorStack = 'SelectorStack',
}

export type IAccountManagerStacksParamList = {
  [EAccountManagerStacksRoutes.SelectorStack]: undefined;
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
  data: IAccountProps[];
};

export type IWalletProps = {
  id: string;
  img: IWalletAvatarProps['img'];
  status?: 'default' | 'connected';
  type?: 'hd' | 'hw' | 'others';
  name: string;
  accounts: IAccountGroupProps[];
};
