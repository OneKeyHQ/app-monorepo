import type {
  EModalFirmwareUpdateRoutes,
  IModalFirmwareUpdateParamList,
} from '@onekeyhq/shared/src/routes';

import { useAppRoute } from '../../../hooks/useAppRoute';

import { FirmwareUpdateInstallPage } from './FirmwareUpdateInstallPageContent';

function PageFirmwareUpdateInstallV2() {
  const route = useAppRoute<
    IModalFirmwareUpdateParamList,
    EModalFirmwareUpdateRoutes.InstallV2
  >();
  return <FirmwareUpdateInstallPage result={route.params.result} />;
}

export default PageFirmwareUpdateInstallV2;
