import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IModalLegacyFirmwareUpdateParamList } from '@onekeyhq/shared/src/routes';
import { EModalLegacyFirmwareUpdateRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const PageLegacyFirmwareUpdate = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/LegacyFirmwareUpdate/pages/PageLegacyFirmwareUpdate'
    ),
);

export const ModalLegacyFirmwareUpdateStack: IModalFlowNavigatorConfig<
  EModalLegacyFirmwareUpdateRoutes,
  IModalLegacyFirmwareUpdateParamList
>[] = [
  {
    name: EModalLegacyFirmwareUpdateRoutes.LegacyUpdate,
    component: PageLegacyFirmwareUpdate,
  },
];
