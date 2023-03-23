import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';

import { ReceiveTokenRoutes } from '../../routes/routesEnum';

export { ReceiveTokenRoutes };

export type ReceiveTokenRoutesParams = {
  [ReceiveTokenRoutes.ReceiveToken]: {
    address?: string;
    name?: string;

    wallet?: Wallet | null;
    network?: Network | null;
    account?: Account | null;
    customPath?: string;
    template?: string;
  };
};
