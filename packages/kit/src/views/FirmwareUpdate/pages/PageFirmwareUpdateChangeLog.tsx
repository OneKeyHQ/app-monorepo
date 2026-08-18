import { useMemo, useRef, useState } from 'react';

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
import {
  EHardwareCallContext,
  type ICheckAllFirmwareReleaseResult,
} from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppRoute } from '../../../hooks/useAppRoute';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { FirmwareChangeLogView } from '../components/FirmwareChangeLogView';
import { FirmwareCheckingLoading } from '../components/FirmwareCheckingLoading';
import { FirmwareLatestVersionInstalled } from '../components/FirmwareLatestVersionInstalled';
import { FirmwareUpdateErrors } from '../components/FirmwareUpdateErrors';
import {
  FirmwareUpdateExitPrevent,
  ForceExtensionUpdatingFromExpandTab,
} from '../components/FirmwareUpdateExitPrevent';
import {
  FirmwareUpdatePageHeaderTitle,
  FirmwareUpdatePageLayout,
} from '../components/FirmwareUpdatePageLayout';
import { FirmwareUpdateWarningMessage } from '../components/FirmwareUpdateWarningMessage';

function PageFirmwareUpdateChangeLog() {
  const route = useAppRoute<
    IModalFirmwareUpdateParamList,
    EModalFirmwareUpdateRoutes.ChangeLog
  >();
  const connectId = route?.params?.connectId;
  const firmwareType = route?.params?.firmwareType;
  const baseReleaseInfo = route?.params?.baseReleaseInfo;
  const [activeConnectId, setActiveConnectId] = useState(connectId);

  const [stepInfo, setStepInfo] = useFirmwareUpdateStepInfoAtom();

  const confirmUpdateResult = useRef<ICheckAllFirmwareReleaseResult>(undefined);

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
        const resolvedTransport =
          await backgroundApiProxy.serviceHardware.resolveHardwareTransport({
            connectId,
            hardwareCallContext: EHardwareCallContext.UPDATE_FIRMWARE,
          });
        const compatibleConnectId = resolvedTransport.connectId;
        setActiveConnectId(compatibleConnectId);

        const r =
          await backgroundApiProxy.serviceFirmwareUpdate.checkAllFirmwareRelease(
            {
              connectId: compatibleConnectId,
              firmwareType,
              baseReleaseInfoCache: baseReleaseInfo,
              resolvedTransportType: resolvedTransport.transportType,
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
          step: EFirmwareUpdateSteps.checkReleaseError,
          payload: {
            error: toPlainErrorObject(error as any),
          },
        });
      }
    },
    [connectId, firmwareType, baseReleaseInfo, setStepInfo],
    {
      watchLoading: true,
    },
  );

  const shouldShowChangeLog =
    stepInfo.step === EFirmwareUpdateSteps.showChangeLog ||
    stepInfo.step === EFirmwareUpdateSteps.showCheckList;

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <>
          <FirmwareUpdateExitPrevent />
          <FirmwareCheckingLoading connectId={activeConnectId} />
        </>
      );
    }
    if (
      stepInfo.step === EFirmwareUpdateSteps.error ||
      stepInfo.step === EFirmwareUpdateSteps.checkReleaseError
    ) {
      return (
        <>
          <FirmwareUpdateWarningMessage />
          <FirmwareUpdateExitPrevent />
          <FirmwareUpdateErrors.WorkflowErrors
            error={stepInfo.payload.error}
            onRetry={run}
            result={result}
          />
        </>
      );
    }
    // keep change log modal content when install modal back
    if (confirmUpdateResult.current) {
      return <FirmwareChangeLogView result={confirmUpdateResult.current} />;
    }
    if (shouldShowChangeLog) {
      return (
        <FirmwareChangeLogView
          result={result}
          onConfirmClick={() => {
            confirmUpdateResult.current = result;
          }}
        />
      );
    }
    return <FirmwareLatestVersionInstalled />;
  }, [
    activeConnectId,
    isLoading,
    result,
    run,
    shouldShowChangeLog,
    stepInfo.payload,
    stepInfo.step,
  ]);

  return (
    <Page
      scrollEnabled
      onUnmounted={async () => {
        console.log('PageFirmwareUpdateChangeLog unmounted');
        await backgroundApiProxy.serviceFirmwareUpdate.exitUpdateWorkflow();
      }}
    >
      <FirmwareUpdatePageLayout
        headerTitle={
          shouldShowChangeLog ? (
            <FirmwareUpdatePageHeaderTitle result={result} />
          ) : undefined
        }
        containerStyle={{
          p:
            stepInfo.step === EFirmwareUpdateSteps.checkReleaseError ? '$5' : 0,
        }}
      >
        <ForceExtensionUpdatingFromExpandTab />
        {content}
      </FirmwareUpdatePageLayout>
    </Page>
  );
}

// PageFirmwareUpdateBootloaderMode
// PageFirmwareUpdateChangeLog
export default PageFirmwareUpdateChangeLog;
