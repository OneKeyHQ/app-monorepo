import type { PropsWithChildren } from 'react';

import type { IActionItemsProps } from '../../../Home/components/WalletActions/RawActions';

export type IActionProps = PropsWithChildren<{
  networkId: string;
  tokenAddress: string;
  tokenSymbol: string;
  accountId: string;
  walletId: string;
  walletType: string | undefined;
  source: 'homePage' | 'tokenDetails' | 'earn' | 'swap';
  isTabView?: boolean;
}> &
  Partial<IActionItemsProps>;
