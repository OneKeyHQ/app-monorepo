import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';

import type { IWalletAvatarProps } from '@onekeyhq/kit/src/components/WalletAvatar';
import type { AvatarImageProps } from 'tamagui';

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
  