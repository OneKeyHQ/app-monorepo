import type { PropsWithChildren } from 'react';

import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives/Icon/Icons';
import type { IFiatCryptoType } from '@onekeyhq/shared/types/fiatCrypto';

export type IActionProps = PropsWithChildren<{
  networkId: string;
  tokenAddress: string;
  accountId: string;
}>;

export type IActionBaseProps = PropsWithChildren<{
  networkId: string;
  tokenAddress: string;
  accountId: string;
  type: IFiatCryptoType;
  label: string;
  icon: IKeyOfIcons;
}>;
