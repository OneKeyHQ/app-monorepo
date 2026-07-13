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

const BatchCreateAccountForm = LazyLoadPage(
  () => import('../pages/BatchCreateAccount/BatchCreateAccountForm'),
);

const BatchCreateAccountPreview = LazyLoadPage(
  () => import('../pages/BatchCreateAccount/BatchCreateAccountPreview'),
);

const HardwareHomeScreenModal = LazyLoadPage(
  () => import('../pages/HardwareHomeScreen/HardwareHomeScreenModal'),
);

const PageResolveSameWallets = LazyLoadPage(
  () => import('../pages/PageResolveSameWallets'),
);

const BotWalletManager = LazyLoadPage(
  () => import('../pages/BotWalletManager'),
);

export const AccountManagerStacks: IModalFlowNavigatorConfig<
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList
>[] = [
  {
    name: EAccountManagerStacksRoutes.AccountSelectorStack,
    component: AccountSelectorStackPage,
    options: {
      headerShown: false,
    },
    // Web-only. This screen visually behaves like a popover; the default
    // modal `scale(0.95) -> 1` bouncy enter animation makes avatars,
    // right-edge action buttons, and other row content appear to jump
    // outward during the overshoot. Disable scale so it only fades in.
    disableEnterScaleAnimation: true,
  },
  {
    name: EAccountManagerStacksRoutes.ExportPrivateKeysPage,
    component: ExportPrivateKeys,
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
    name: EAccountManagerStacksRoutes.HardwareHomeScreenModal,
    component: HardwareHomeScreenModal,
  },
  {
    name: EAccountManagerStacksRoutes.PageResolveSameWallets,
    component: PageResolveSameWallets,
  },
  {
    name: EAccountManagerStacksRoutes.BotWalletManager,
    component: BotWalletManager,
  },
];
