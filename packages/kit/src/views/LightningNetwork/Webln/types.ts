import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import { WeblnModalRoutes } from '../../../routes/routesEnum';

export { WeblnModalRoutes };

export type WeblnRoutesParams = {
  [WeblnModalRoutes.MakeInvoice]: {
    sourceInfo: IDappSourceInfo;
  };
  [WeblnModalRoutes.VerifyMessage]: {
    sourceInfo: IDappSourceInfo;
  };
};
