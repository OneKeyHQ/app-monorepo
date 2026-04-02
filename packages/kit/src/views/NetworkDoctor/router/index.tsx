import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import type { IModalNetworkDoctorParamList } from '@onekeyhq/shared/src/routes/networkDoctor';
import { EModalNetworkDoctorPages } from '@onekeyhq/shared/src/routes/networkDoctor';

const NetworkDoctorResult = LazyLoad(
  () =>
    import('@onekeyhq/kit/src/views/NetworkDoctor/pages/NetworkDoctorResult'),
);

export const NetworkDoctorModalRouter: IModalFlowNavigatorConfig<
  EModalNetworkDoctorPages,
  IModalNetworkDoctorParamList
>[] = [
  {
    name: EModalNetworkDoctorPages.NetworkDoctorResult,
    component: NetworkDoctorResult,
  },
];
