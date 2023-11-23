import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import { NostrModalRoutes } from '../../routes/routesEnum';

export { NostrModalRoutes };

export type NostrRoutesParams = {
  [NostrModalRoutes.GetPublicKey]: {
    sourceInfo: IDappSourceInfo;
  };
  [NostrModalRoutes.NostrAuthentication]: {
    onDone: (password: string) => void;
    walletId: string;
  };
};
