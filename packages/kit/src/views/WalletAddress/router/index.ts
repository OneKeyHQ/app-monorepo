import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { EModalWalletAddressRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalWalletAddressParamList } from '@onekeyhq/shared/src/routes';

const DeriveTypesAddress = LazyLoad(
  () =>
    import('@onekeyhq/kit/src/views/WalletAddress/pages/DeriveTypesAddress'),
);

const WalletAddress = LazyLoad(
  () => import('@onekeyhq/kit/src/views/WalletAddress/pages/WalletAddress'),
);

export const WalletAddressModalRouter: IModalFlowNavigatorConfig<
  EModalWalletAddressRoutes,
  IModalWalletAddressParamList
>[] = [
  {
    name: EModalWalletAddressRoutes.DeriveTypesAddress,
    component: DeriveTypesAddress,
  },
  {
    name: EModalWalletAddressRoutes.WalletAddress,
    component: WalletAddress,
  },
];
