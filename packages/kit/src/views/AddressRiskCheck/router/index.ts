import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { EModalAddressRiskCheckRoutes } from '@onekeyhq/shared/src/routes/addressRiskCheck';
import type { IModalAddressRiskCheckParamList } from '@onekeyhq/shared/src/routes/addressRiskCheck';

const AddressRiskCheckInput = LazyLoad(
  () =>
    import('@onekeyhq/kit/src/views/AddressRiskCheck/pages/AddressRiskCheckInput'),
);

const AddressRiskCheckResult = LazyLoad(
  () =>
    import('@onekeyhq/kit/src/views/AddressRiskCheck/pages/AddressRiskCheckResult'),
);

const AddressRiskCheckHistory = LazyLoad(
  () =>
    import('@onekeyhq/kit/src/views/AddressRiskCheck/pages/AddressRiskCheckHistory'),
);

export const AddressRiskCheckModalRouter: IModalFlowNavigatorConfig<
  EModalAddressRiskCheckRoutes,
  IModalAddressRiskCheckParamList
>[] = [
  {
    name: EModalAddressRiskCheckRoutes.AddressRiskCheckInput,
    component: AddressRiskCheckInput,
  },
  {
    name: EModalAddressRiskCheckRoutes.AddressRiskCheckResult,
    component: AddressRiskCheckResult,
  },
  {
    name: EModalAddressRiskCheckRoutes.AddressRiskCheckHistory,
    component: AddressRiskCheckHistory,
  },
];
