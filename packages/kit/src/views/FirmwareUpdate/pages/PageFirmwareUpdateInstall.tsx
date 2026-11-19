import { useMemo } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';

import { Page } from '@onekeyhq/components';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateStepInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  EModalFirmwareUpdateRoutes,
  IModalFirmwareUpdateParamList,
} from '@onekeyhq/shared/src/routes';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

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
import { useFirmwareUpdateWorkflowLifetime } from '../hooks/useFirmwareUpdateHooks';

import { FirmwareUpdateInstallPage } from './FirmwareUpdateInstallPageContent';

/**
 * Legacy install page, kept only for Mini: its manual-bootloader guide with
 * the illustrated instructions has no equivalent in the unified page yet.
 */
function PageFirmwareUpdateInstallMini({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const navigation = useAppNavigation();

  const [stepInfo] = useFirmwareUpdateStepInfoAtom();

  useFirmwareUpdateWorkflowLifetime({
    onReallyLeave: async () => {
      await backgroundApiProxy.serviceFirmwareUpdate.exitUpdateWorkflow();
      if (result?.originalConnectId) {
        await backgroundApiProxy.serviceHardware.cancel({
          connectId: result.originalConnectId,
          forceDeviceResetToHome: true,
        });
      }
    },
  });

  const content = useMemo(() => {
    if (
      stepInfo.step === EFirmwareUpdateSteps.updateStart ||
      stepInfo.step === EFirmwareUpdateSteps.installing ||
      stepInfo.step ===
        EFirmwareUpdateSteps.requestDeviceInBootloaderForWebDevice ||
      stepInfo.step ===
        EFirmwareUpdateSteps.requestDeviceForSwitchFirmwareWebDevice ||
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
          <FirmwareInstallingView result={result} />
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
  }, [stepInfo.step, navigation, result]);

  return (
    <Page scrollEnabled>
      <FirmwareUpdatePageLayout>
        <ForceExtensionUpdatingFromExpandTab />
        {content}
      </FirmwareUpdatePageLayout>
    </Page>
  );
}

function PageFirmwareUpdateInstall() {
  const route = useAppRoute<
    IModalFirmwareUpdateParamList,
    EModalFirmwareUpdateRoutes.Install
  >();
  const { result } = route.params;

  if (result?.deviceType === EDeviceType.Mini) {
    return <PageFirmwareUpdateInstallMini result={result} />;
  }

  return <FirmwareUpdateInstallPage result={result} />;
}

export default PageFirmwareUpdateInstall;
