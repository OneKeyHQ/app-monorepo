import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IModalFirmwareUpdateParamList } from '@onekeyhq/shared/src/routes';
import { EModalFirmwareUpdateRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const PageFirmwareUpdateChangeLog = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/FirmwareUpdate/pages/PageFirmwareUpdateChangeLog'
    ),
);

export const ModalFirmwareUpdateStack: IModalFlowNavigatorConfig<
  EModalFirmwareUpdateRoutes,
  IModalFirmwareUpdateParamList
>[] = [
  {
    name: EModalFirmwareUpdateRoutes.ChangeLog,
    component: PageFirmwareUpdateChangeLog,
  },
];
