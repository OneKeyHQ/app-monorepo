import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';

import { ReceiveTokenModalRoutes } from '../../routes/routesEnum';

export { ReceiveTokenModalRoutes };

export type ReceiveTokenRoutesParams = {
  [ReceiveTokenModalRoutes.ReceiveToken]: {
    address?: string;
    displayAddress?: string;
    name?: string;

    wallet?: Wallet | null;
    network?: Network | null;
    account?: Account | null;
    customPath?: string;
    template?: string;
    receiveInscription?: boolean;
  };
  [ReceiveTokenModalRoutes.CreateInvoice]: {
    networkId?: string;
    accountId?: string;
  };
  [ReceiveTokenModalRoutes.ReceiveInvoice]: {
    networkId?: string;
    accountId?: string;
    paymentHash: string;
    paymentRequest: string;
  };
};
