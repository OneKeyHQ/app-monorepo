import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IAccountManagerStacksParamList } from '@onekeyhq/shared/src/routes';
import { EAccountManagerStacksRoutes } from '@onekeyhq/shared/src/routes/accountManagerStacks';

const AccountSelectorStackPage = LazyLoadPage(
  () => import('../pages/AccountSelectorStack'),
);

const ExportPrivateKeys = LazyLoadPage(
  () => import('../pages/ExportKeys/ExportPrivateKeys'),
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
    name: EAccountManagerStacksRoutes.ExportPrivateKeysPage,
    component: ExportPrivateKeys,
  },
];
