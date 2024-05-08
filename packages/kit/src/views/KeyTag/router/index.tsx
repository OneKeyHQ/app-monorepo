import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { EModalKeyTagRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalKeyTagParamList } from '@onekeyhq/shared/src/routes';

const BackupWallet = LazyLoad(
  () => import('@onekeyhq/kit/src/views/KeyTag/pages/BackupWallet'),
);

const UserOptions = LazyLoad(
  () => import('@onekeyhq/kit/src/views/KeyTag/pages/UserOptions'),
);

const BackupDotMap = LazyLoad(
  () => import('@onekeyhq/kit/src/views/KeyTag/pages/BackupDotMap'),
);

const BackupRecoveryPhrase = LazyLoad(
  () => import('@onekeyhq/kit/src/views/KeyTag/pages/BackupRecoveryPhrase'),
);

const BackupDocs = LazyLoad(
  () => import('@onekeyhq/kit/src/views/KeyTag/pages/BackupDocs'),
);

export const KeyTagModalRouter: IModalFlowNavigatorConfig<
  EModalKeyTagRoutes,
  IModalKeyTagParamList
>[] = [
  {
    name: EModalKeyTagRoutes.BackupWallet,
    component: BackupWallet,
  },
  {
    name: EModalKeyTagRoutes.UserOptions,
    component: UserOptions,
  },
  {
    name: EModalKeyTagRoutes.BackupDotMap,
    component: BackupDotMap,
  },
  {
    name: EModalKeyTagRoutes.BackupRecoveryPhrase,
    component: BackupRecoveryPhrase,
  },
  {
    name: EModalKeyTagRoutes.BackupDocs,
    component: BackupDocs,
  },
];
