import { useMemo } from 'react';

import { Page } from '@onekeyhq/components';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateStepInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import type {
  EModalFirmwareUpdateRoutes,
  IModalFirmwareUpdateParamList,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAppRoute } from '../../../hooks/useAppRoute';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { FirmwareChangeLogView } from '../components/FirmwareChangeLogView';
import { FirmwareCheckingLoading } from '../components/FirmwareCheckingLoading';
import { FirmwareInstallingView } from '../components/FirmwareInstallingView';
import { FirmwareLatestVersionInstalled } from '../components/FirmwareLatestVersionInstalled';
import { FirmwareUpdateCheckList } from '../components/FirmwareUpdateCheckList';
import { FirmwareUpdateErrors } from '../components/FirmwareUpdateErrors';
import { FirmwareUpdateExitPrevent } from '../components/FirmwareUpdateExitPrevent';
import { FirmwareUpdatePageLayout } from '../components/FirmwareUpdatePageLayout';

function PageFirmwareUpdateChangeLog() {
  const route = useAppRoute<
    IModalFirmwareUpdateParamList,
    EModalFirmwareUpdateRoutes.ChangeLog
  >();
  const connectId = route?.params?.connectId;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigation = useAppNavigation();
  const [stepInfo, setStepInfo] = useFirmwareUpdateStepInfoAtom();

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

  const { result, run, isLoading } = usePromiseResult(
    async () => {
      try {
        const r =
          await backgroundApiProxy.serviceFirmwareUpdate.checkAllFirmwareRelease(
            {
              connectId,
            },
          );
        if (r?.hasUpgrade) {
          setStepInfo({
            step: EFirmwareUpdateSteps.showChangeLog,
            payload: undefined,
          });
        } else {
          //
        }
        return r;
      } catch (error) {
        setStepInfo({
          step: EFirmwareUpdateSteps.error,
          payload: {
            error: toPlainErrorObject(error as any),
          },
        });
      }
    },
    [connectId, setStepInfo],
    {
      watchLoading: true,
    },
  );

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <>
          <FirmwareUpdateExitPrevent />
          <FirmwareCheckingLoading connectId={connectId} />
        </>
      );
    }
    if (stepInfo.step === EFirmwareUpdateSteps.error) {
      return (
        <FirmwareUpdateErrors.WorkflowErrors
          error={stepInfo.payload.error}
          onRetry={run}
          result={result}
        />
      );
    }
    if (stepInfo.step === EFirmwareUpdateSteps.showChangeLog) {
      return <FirmwareChangeLogView result={result} />;
    }
    if (stepInfo.step === EFirmwareUpdateSteps.showCheckList) {
      return <FirmwareUpdateCheckList result={result} />;
    }
    if (
      stepInfo.step === EFirmwareUpdateSteps.updateStart ||
      stepInfo.step === EFirmwareUpdateSteps.installing ||
      stepInfo.step === EFirmwareUpdateSteps.updateDone
    ) {
      return (
        <>
          <FirmwareUpdateExitPrevent />
          <FirmwareInstallingView
            result={result}
            isDone={stepInfo.step === EFirmwareUpdateSteps.updateDone}
          />
        </>
      );
    }

    return (
      <>
        <FirmwareLatestVersionInstalled />
      </>
    );
  }, [connectId, isLoading, result, run, stepInfo.payload, stepInfo.step]);

  return (
    <Page
      scrollEnabled
      onUnmounted={async () => {
        console.log('PageFirmwareUpdateChangeLog unmounted');
        await backgroundApiProxy.serviceFirmwareUpdate.exitUpdateWorkflow();
      }}
    >
      <FirmwareUpdatePageLayout>{content}</FirmwareUpdatePageLayout>
    </Page>
  );
}

// PageFirmwareUpdateBootloaderMode
// PageFirmwareUpdateChangeLog
export default PageFirmwareUpdateChangeLog;
