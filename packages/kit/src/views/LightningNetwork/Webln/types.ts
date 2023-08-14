import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import { WeblnModalRoutes } from '../../../routes/routesEnum';

export { WeblnModalRoutes };

export type WeblnRoutesParams = {
  [WeblnModalRoutes.MakeInvoice]: {
    sourceInfo: IDappSourceInfo;
  };
  [WeblnModalRoutes.SignMessage]: {
    sourceInfo: IDappSourceInfo;
  };
  [WeblnModalRoutes.WeblnAuthentication]: {
    onDone: (password: string) => void;
    walletId: string;
  };
};
