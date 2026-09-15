import { Page } from '@onekeyhq/components';
import type {
  EModalFirmwareUpdateRoutes,
  IModalFirmwareUpdateParamList,
} from '@onekeyhq/shared/src/routes';

import { useAppRoute } from '../../../hooks/useAppRoute';
import { ForceExtensionUpdatingFromExpandTab } from '../components/FirmwareUpdateExitPrevent';
import { FirmwareUpdatePageLayout } from '../components/FirmwareUpdatePageLayout';
import { firmwareUpdateInstallCopy } from '../componentsV2/firmwareUpdateInstallCopy';

import {
  FirmwareUpdateInstallPageContent,
  INSTALL_PAGE_SCROLL_PROPS,
} from './FirmwareUpdateInstallPageContent';

function PageFirmwareUpdateInstallV2() {
  const route = useAppRoute<
    IModalFirmwareUpdateParamList,
    EModalFirmwareUpdateRoutes.InstallV2
  >();
  const { result } = route.params;

  return (
    <Page scrollEnabled scrollProps={INSTALL_PAGE_SCROLL_PROPS}>
      <FirmwareUpdatePageLayout
        title={firmwareUpdateInstallCopy.pageTitle}
        containerStyle={{ py: '0', px: '$5', flex: 1 }}
      >
        <ForceExtensionUpdatingFromExpandTab />
        <FirmwareUpdateInstallPageContent result={result} />
      </FirmwareUpdatePageLayout>
    </Page>
  );
}

export default PageFirmwareUpdateInstallV2;
