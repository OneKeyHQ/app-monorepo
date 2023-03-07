import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';

export type ReceiveTokenRoutesParams = {
  address?: string;
  name?: string;

  wallet?: Wallet | null;
  network?: Network | null;
  account?: Account | null;
};
