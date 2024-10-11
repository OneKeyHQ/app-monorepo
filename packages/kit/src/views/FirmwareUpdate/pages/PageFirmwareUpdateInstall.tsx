import { useMemo } from 'react';

import { Page } from '@onekeyhq/components';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateStepInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  EModalFirmwareUpdateRoutes,
  IModalFirmwareUpdateParamList,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAppRoute } from '../../../hooks/useAppRoute';
import { FirmwareInstallingView } from '../components/FirmwareInstallingView';
import { FirmwareLatestVersionInstalled } from '../components/FirmwareLatestVersionInstalled';
import {
  FirmwareUpdateExitPrevent,
  ForceExtensionUpdatingFromExpandTab,
} from '../components/FirmwareUpdateExitPrevent';
import { FirmwareUpdatePageLayout } from '../components/FirmwareUpdatePageLayout';
import { FirmwareUpdateWarningMessage } from '../components/FirmwareUpdateWarningMessage';

function PageFirmwareUpdateInstall() {
  const route = useAppRoute<
    IModalFirmwareUpdateParamList,
    EModalFirmwareUpdateRoutes.Install
  >();
  const { result } = route.params;

  const navigation = useAppNavigation();
  const [stepInfo] = useFirmwareUpdateStepInfoAtom();

  /*
     await backgroundApiProxy.serviceFirmwareUpdate.startFirmwareUpdateWorkflow(
              {
                backuped: true,
                usbConnected: true,
                connectId: firmwareUpdateInfo.connectId,
                updateFirmware: firmwareUpdateInfo,
                updateBle: bleUpdateInfo,
              },
            )

            */

  const content = useMemo(() => {
    if (
      stepInfo.step === EFirmwareUpdateSteps.updateStart ||
      stepInfo.step === EFirmwareUpdateSteps.installing ||
      stepInfo.step === EFirmwareUpdateSteps.updateDone
    ) {
      const isDone = stepInfo.step === EFirmwareUpdateSteps.updateDone;
      return (
        <>
          {!isDone ? (
            <>
              <FirmwareUpdateWarningMessage />
              <FirmwareUpdateExitPrevent />
            </>
          ) : null}
          <FirmwareInstallingView result={result} isDone={isDone} />
        </>
      );
    }

    if (stepInfo.step === EFirmwareUpdateSteps.error) {
      requestAnimationFrame(() => {
        navigation.pop();
      });
      return <FirmwareUpdateExitPrevent shouldPreventRemove={false} />;
    }

    return (
      <>
        <FirmwareLatestVersionInstalled />
      </>
    );
  }, [stepInfo.step, result, navigation]);

  return (
    <Page
      scrollEnabled
      onUnmounted={async () => {
        console.log('PageFirmwareUpdateInstall unmounted');
        await backgroundApiProxy.serviceFirmwareUpdate.exitUpdateWorkflow();
      }}
    >
      <FirmwareUpdatePageLayout>
        <ForceExtensionUpdatingFromExpandTab />
        {content}
      </FirmwareUpdatePageLayout>
    </Page>
  );
}

// PageFirmwareUpdateBootloaderMode
// PageFirmwareUpdateInstall
export default PageFirmwareUpdateInstall;
