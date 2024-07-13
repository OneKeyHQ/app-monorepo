import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IAccountManagerStacksParamList } from '@onekeyhq/shared/src/routes';
import { EAccountManagerStacksRoutes } from '@onekeyhq/shared/src/routes/accountManagerStacks';

const AccountSelectorStackPage = LazyLoadPage(
  () => import('../pages/AccountSelectorStack'),
);

const BatchCreateAccountForm = LazyLoadPage(
  () => import('../pages/BatchCreateAccountPage/BatchCreateAccountForm'),
);

const BatchCreateAccountPreview = LazyLoadPage(
  () => import('../pages/BatchCreateAccountPage/BatchCreateAccountPreview'),
);

const BatchCreateAccountProcessing = LazyLoadPage(
  () => import('../pages/BatchCreateAccountPage/BatchCreateAccountProcessing'),
);

export const AccountManagerStacks: IModalFlowNavigatorConfig<
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList
>[] = [
  {
    name: EAccountManagerStacksRoutes.AccountSelectorStack,
    component: AccountSelectorStackPage,
  },
  {
    name: EAccountManagerStacksRoutes.BatchCreateAccountForm,
    component: BatchCreateAccountForm,
  },
  {
    name: EAccountManagerStacksRoutes.BatchCreateAccountPreview,
    component: BatchCreateAccountPreview,
  },
  {
    name: EAccountManagerStacksRoutes.BatchCreateAccountProcessing,
    component: BatchCreateAccountProcessing,
  },
];
