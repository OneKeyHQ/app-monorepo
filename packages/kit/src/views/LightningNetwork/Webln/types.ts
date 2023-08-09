import { WeblnModalRoutes } from '../../../routes/routesEnum';

export { WeblnModalRoutes };

export type WeblnRoutesParams = {
  [WeblnModalRoutes.MakeInvoice]: {
    amount: string;
  };
};
