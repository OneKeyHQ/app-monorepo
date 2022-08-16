import { Account } from '@onekeyhq/engine/src/types/account';
import { Network } from '@onekeyhq/engine/src/types/network';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';

export enum ReceiveTokenRoutes {
  ReceiveToken = 'ReceiveToken',
}

export type ReceiveTokenRoutesParams = {
  [ReceiveTokenRoutes.ReceiveToken]: {
    address?: string;
    name?: string;

    wallet?: Wallet | null;
    network?: Network | null;
    account?: Account | null;
  };
};
