import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateStepInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  type EModalFirmwareUpdateRoutes,
  type IModalFirmwareUpdateParamList,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAppRoute } from '../../../hooks/useAppRoute';
import { FirmwareLatestVersionInstalled } from '../components/FirmwareLatestVersionInstalled';
import {
  FirmwareUpdateExitPrevent,
  ForceExtensionUpdatingFromExpandTab,
} from '../components/FirmwareUpdateExitPrevent';
import {
  FirmwareUpdatePageFooter,
  FirmwareUpdatePageLayout,
} from '../components/FirmwareUpdatePageLayout';
import { FirmwareInstallingViewV2 } from '../componentsV2/FirmwareInstallingViewV2';
import { FirmwareUpdateAlertInfoMessage } from '../componentsV2/FirmwareUpdateAlertInfoMessage';
import { useFirmwareUpdateActions } from '../hooks/useFirmwareUpdateActions';

function PageFirmwareUpdateInstallV2() {
  const route = useAppRoute<
    IModalFirmwareUpdateParamList,
    EModalFirmwareUpdateRoutes.InstallV2
  >();
  const intl = useIntl();
  const { result } = route.params;

  const navigation = useAppNavigation();
  const actions = useFirmwareUpdateActions();
  const [stepInfo] = useFirmwareUpdateStepInfoAtom();
  const [isDoneInternal, setIsDoneInternal] = useState(false);
  const isDone = stepInfo.step === EFirmwareUpdateSteps.updateDone;
  const needOnboarding =
    stepInfo.step === EFirmwareUpdateSteps.updateDone
      ? stepInfo.payload?.needOnboarding ?? false
      : false;

  useEffect(() => {
    setTimeout(() => {
      setIsDoneInternal(isDone);
    }, 1500);
  }, [isDone]);

  const onCloseUpdateModal = useCallback(() => {
    actions.closeUpdateModal();
  }, [actions]);

  const onRestartOnboarding = useCallback(async () => {
    void actions.restartOnboarding({ deviceType: result?.deviceType });
  }, [actions, result?.deviceType]);

  const FooterContent = useMemo(() => {
    if (isDoneInternal && needOnboarding) {
      return (
        <FirmwareUpdatePageFooter
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_import_wallet,
          })}
          onConfirm={onRestartOnboarding}
        />
      );
    }

    if (isDoneInternal) {
      return (
        <FirmwareUpdatePageFooter
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_close,
          })}
          onConfirm={onCloseUpdateModal}
        />
      );
    }
    return null;
  }, [
    intl,
    isDoneInternal,
    needOnboarding,
    onCloseUpdateModal,
    onRestartOnboarding,
  ]);

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
      stepInfo.step ===
        EFirmwareUpdateSteps.requestDeviceInBootloaderForWebDevice ||
      stepInfo.step ===
        EFirmwareUpdateSteps.requestDeviceForSwitchFirmwareWebDevice ||
      stepInfo.step === EFirmwareUpdateSteps.updateDone
    ) {
      return (
        <>
          {!isDoneInternal ? (
            <>
              <FirmwareUpdateExitPrevent />
              <FirmwareUpdateAlertInfoMessage />
            </>
          ) : null}
          {/* FirmwareInstallingViewV2 ->  FirmwareInstallingViewBase -> FirmwareUpdateProgressBar */}
          <FirmwareInstallingViewV2 result={result} isDone={isDone} />
          {FooterContent}
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
  }, [
    stepInfo.step,
    result,
    navigation,
    isDone,
    isDoneInternal,
    FooterContent,
  ]);

  return (
    <Page
      scrollEnabled
      onUnmounted={async () => {
        console.log('PageFirmwareUpdateInstall unmounted');
        await backgroundApiProxy.serviceFirmwareUpdate.exitUpdateWorkflow();
        if (result?.originalConnectId) {
          await backgroundApiProxy.serviceHardware.cancel({
            connectId: result.originalConnectId,
            forceDeviceResetToHome: true,
          });
        }
      }}
    >
      <FirmwareUpdatePageLayout
        containerStyle={{
          py: '0',
          px: '$5',
        }}
      >
        <ForceExtensionUpdatingFromExpandTab />
        {content}
      </FirmwareUpdatePageLayout>
    </Page>
  );
}

export default PageFirmwareUpdateInstallV2;
