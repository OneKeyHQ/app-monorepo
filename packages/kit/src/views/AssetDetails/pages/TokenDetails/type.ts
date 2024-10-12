import type { PropsWithChildren } from 'react';

import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives/Icon/Icons';
import type { IFiatCryptoType } from '@onekeyhq/shared/types/fiatCrypto';

import type { IActionItemsProps } from '../../../Home/components/WalletActions/RawActions';

export type IActionProps = PropsWithChildren<{
  networkId: string;
  tokenAddress: string;
  accountId: string;
  walletType: string | undefined;
}> &
  Partial<IActionItemsProps>;

export type IActionBaseProps = PropsWithChildren<{
  networkId: string;
  tokenAddress: string;
  accountId: string;
  type: IFiatCryptoType;
  label: string;
  icon: IKeyOfIcons;
  walletType: string | undefined;
}> &
  Partial<IActionItemsProps>;
