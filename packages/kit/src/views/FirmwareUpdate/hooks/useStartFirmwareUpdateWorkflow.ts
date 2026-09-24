import { useCallback } from 'react';

import {
  EFirmwareUpdateSteps,
  settingsPersistAtom,
  useFirmwareUpdateStepInfoAtom,
  useFirmwareUpdateWorkflowRunningAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  classifyFirmwareUpdateFailure,
  resolveFirmwareUpdateErrorCode,
  toUserFacingFirmwareUpdateError,
} from '@onekeyhq/shared/src/errors/utils/firmwareUpdateErrorUtils';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { parseFirmwareVersions } from '@onekeyhq/shared/src/logger/scopes/update/scenes/firmwareVersions';
import { EModalFirmwareUpdateRoutes } from '@onekeyhq/shared/src/routes';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

/**
 * Starts (or restarts) the install workflow for a release result. Shared by
 * the pre-update checklist and the install page's retry after a workflow-level
 * failure, so both take the same path and the checklist is not shown twice.
 */
export function useStartFirmwareUpdateWorkflow() {
  const navigation = useAppNavigation();
  const [, setStepInfo] = useFirmwareUpdateStepInfoAtom();
  const [, setWorkflowIsRunning] = useFirmwareUpdateWorkflowRunningAtom();

  const start = useCallback(
    async ({
      result,
      navigateToInstallPage,
    }: {
      result: ICheckAllFirmwareReleaseResult;
      /** false when already on the install page (retry after failure). */
      navigateToInstallPage: boolean;
    }) => {
      const useV2FirmwareUpdateFlow =
        await deviceUtils.shouldUseV2FirmwareUpdateFlow({
          features: result?.features,
        });
      // Analytics only; read at call time so the hook does not subscribe
      // every mounted page to the whole settings atom.
      const { hardwareTransportType } = await settingsPersistAtom.get();
      const updateFirmwareInfo = result?.updateInfos?.firmware;
      let shouldResetWorkflowRunningInUi = true;
      try {
        // Allow workflow to continue even if component unmounts
        // The workflow runs in background service and doesn't depend on component lifecycle
        setStepInfo({
          step: EFirmwareUpdateSteps.updateStart,
          payload: {
            startAtTime: Date.now(),
          },
        });

        if (!useV2FirmwareUpdateFlow) {
          defaultLogger.update.firmware.firmwareUpdateStarted({
            deviceType: result?.deviceType,
            transportType: hardwareTransportType,
            updateFlow: 'v1',
            firmwareVersions: parseFirmwareVersions(result),
          });
        }

        if (useV2FirmwareUpdateFlow) {
          if (navigateToInstallPage) {
            navigation.push(EModalFirmwareUpdateRoutes.InstallV2, {
              result,
            });
          }
          setWorkflowIsRunning(true);
          const { backgroundTaskStarted } =
            await backgroundApiProxy.serviceFirmwareUpdate.startUpdateWorkflowV2(
              {
                backuped: true,
                usbConnected: true,
                releaseResult: result,
              },
            );
          if (backgroundTaskStarted) {
            shouldResetWorkflowRunningInUi = false;
            return;
          }
          throw new OneKeyLocalError(
            'Firmware update background task failed to start',
          );
        }
        if (navigateToInstallPage) {
          navigation.push(EModalFirmwareUpdateRoutes.Install, {
            result,
          });
        }
        setWorkflowIsRunning(true);
        await backgroundApiProxy.serviceFirmwareUpdate.startUpdateWorkflow({
          backuped: true,
          usbConnected: true,
          releaseResult: result,
        });

        // Never let analytics context reading break the update flow
        const trackingInfo = await backgroundApiProxy.serviceFirmwareUpdate
          .getUpdateWorkflowTrackingInfo()
          .catch(() => undefined);
        defaultLogger.update.firmware.firmwareUpdateResult({
          deviceType: result?.deviceType,
          transportType: hardwareTransportType,
          updateFlow: useV2FirmwareUpdateFlow ? 'v2' : 'v1',
          firmwareVersions: parseFirmwareVersions(result),
          fromFirmwareType: updateFirmwareInfo?.fromFirmwareType,
          toFirmwareType: updateFirmwareInfo?.toFirmwareType,
          status: 'success',
          retryCount: trackingInfo?.retryCount,
          totalDurationMs: trackingInfo?.totalDurationMs,
          transferredBytes: trackingInfo?.transferredBytes,
          totalBytes: trackingInfo?.totalBytes,
          averageTransferRateBytesPerSecond:
            trackingInfo?.averageTransferRateBytesPerSecond,
          transferDurationMs: trackingInfo?.transferDurationMs,
        });

        const { fromFirmwareType, toFirmwareType } = updateFirmwareInfo ?? {
          fromFirmwareType: undefined,
          toFirmwareType: undefined,
        };
        const needOnboarding =
          fromFirmwareType &&
          toFirmwareType &&
          fromFirmwareType !== toFirmwareType;

        setStepInfo({
          step: EFirmwareUpdateSteps.updateDone,
          payload: {
            needOnboarding,
          },
        });
      } catch (error) {
        const err = toPlainErrorObject(error as any);
        const displayError = toUserFacingFirmwareUpdateError(err);
        const failureType = classifyFirmwareUpdateFailure(err);
        setStepInfo({
          step: EFirmwareUpdateSteps.error,
          payload: {
            error: displayError,
          },
        });
        // Never let analytics context reading break the update flow
        const trackingInfo = await backgroundApiProxy.serviceFirmwareUpdate
          .getUpdateWorkflowTrackingInfo()
          .catch(() => undefined);
        const resultFailureType =
          failureType === 'cancelled'
            ? trackingInfo?.lastFailureType
            : failureType;
        if (resultFailureType && resultFailureType !== 'cancelled') {
          defaultLogger.update.firmware.firmwareUpdateResult({
            deviceType: result?.deviceType,
            transportType: hardwareTransportType,
            updateFlow: useV2FirmwareUpdateFlow ? 'v2' : 'v1',
            firmwareVersions: parseFirmwareVersions(result),
            fromFirmwareType: updateFirmwareInfo?.fromFirmwareType,
            toFirmwareType: updateFirmwareInfo?.toFirmwareType,
            status: 'failed',
            failureType: resultFailureType,
            errorCode:
              failureType === 'cancelled'
                ? trackingInfo?.lastErrorCode
                : resolveFirmwareUpdateErrorCode(err),
            retryCount: trackingInfo?.retryCount,
            totalDurationMs: trackingInfo?.totalDurationMs,
            transferredBytes: trackingInfo?.transferredBytes,
            totalBytes: trackingInfo?.totalBytes,
            averageTransferRateBytesPerSecond:
              trackingInfo?.averageTransferRateBytesPerSecond,
            transferDurationMs: trackingInfo?.transferDurationMs,
          });
        }
      } finally {
        if (shouldResetWorkflowRunningInUi) {
          setWorkflowIsRunning(false);
        }
      }
    },
    [navigation, setStepInfo, setWorkflowIsRunning],
  );

  return { start };
}
