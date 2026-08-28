import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Checkbox, Dialog, Stack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateStepInfoAtom,
  useFirmwareUpdateWorkflowRunningAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  classifyFirmwareUpdateFailure,
  resolveFirmwareUpdateErrorCode,
  toUserFacingFirmwareUpdateError,
} from '@onekeyhq/shared/src/errors/utils/firmwareUpdateErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { parseFirmwareVersions } from '@onekeyhq/shared/src/logger/scopes/update/scenes/firmwareVersions';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalFirmwareUpdateRoutes } from '@onekeyhq/shared/src/routes';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { isBluetoothFirmwareUpdateTransport } from '../firmwareUpdateTransportUtils';
import { FirmwareUpdateTestIDs } from '../testIDs';

export function FirmwareUpdateCheckList({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [, setStepInfo] = useFirmwareUpdateStepInfoAtom();
  const [, setWorkflowIsRunning] = useFirmwareUpdateWorkflowRunningAtom();
  const [{ hardwareTransportType }] = useSettingsPersistAtom();
  const isMountedRef = useRef(true);
  const isBluetoothTransport = isBluetoothFirmwareUpdateTransport({
    isNative: platformEnv.isNative,
  });

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const checkItems = useMemo(
    () => [
      {
        id: 'backup',
        label: intl.formatMessage({
          id: ETranslations.update_i_have_backed_up_my_recovery_phrase,
        }),
        emoji: '✅',
      },
      {
        id: 'connection',
        label: intl.formatMessage({
          id: isBluetoothTransport
            ? ETranslations.update_device_connected_via_bluetooth
            : ETranslations.update_device_connected_via_usb,
        }),
        emoji: isBluetoothTransport ? '📲' : '🔌',
      },
      ...(isBluetoothTransport
        ? []
        : [
            {
              id: 'single-device',
              label: intl.formatMessage({
                id: ETranslations.update_only_one_device_connected,
              }),
              emoji: '📱',
            },
            {
              id: 'apps-closed',
              label: intl.formatMessage({
                id: ETranslations.update_all_other_apps_closed,
              }),
              emoji: '🆗',
            },
          ]),
    ],
    [intl, isBluetoothTransport],
  );
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const onCheckChanged = useCallback((id: string) => {
    if (!isMountedRef.current) return;
    setCheckedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);
  const isAllChecked = useMemo(
    () => checkItems.every((item) => checkedMap[item.id]),
    [checkItems, checkedMap],
  );

  return (
    <Stack>
      <Stack>
        {checkItems.map((item) => {
          const checked = !!checkedMap[item.id];
          return (
            <Checkbox
              key={item.id}
              value={checked}
              testID={FirmwareUpdateTestIDs.checklistCheckbox}
              label={checked ? `${item.label} ${item.emoji}` : item.label}
              onChange={() => onCheckChanged(item.id)}
            />
          );
        })}
      </Stack>
      <Dialog.Footer
        confirmButtonProps={{
          disabled: !isAllChecked,
        }}
        onConfirm={
          result
            ? async (dialog) => {
                const useV2FirmwareUpdateFlow =
                  await deviceUtils.shouldUseV2FirmwareUpdateFlow({
                    features: result?.features,
                  });

                const updateFirmwareInfo = result?.updateInfos?.firmware;
                let shouldResetWorkflowRunningInUi = true;
                try {
                  await dialog.close();

                  // Wait for React Native Fabric to complete view cleanup
                  // This prevents RetryableMountingLayerException during rapid navigation
                  await timerUtils.wait(150);

                  // Allow workflow to continue even if component unmounts
                  // The workflow runs in background service and doesn't depend on component lifecycle

                  setStepInfo({
                    step: EFirmwareUpdateSteps.updateStart,
                    payload: {
                      startAtTime: Date.now(),
                    },
                  });

                  defaultLogger.update.firmware.firmwareUpdateStarted({
                    deviceType: result?.deviceType,
                    transportType: hardwareTransportType,
                    updateFlow: useV2FirmwareUpdateFlow ? 'v2' : 'v1',
                    firmwareVersions: parseFirmwareVersions(result),
                  });

                  if (useV2FirmwareUpdateFlow) {
                    await backgroundApiProxy.serviceFirmwareUpdate.clearHardwareUiStateBeforeStartUpdateWorkflow();
                    navigation.push(EModalFirmwareUpdateRoutes.InstallV2, {
                      result,
                    });
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
                  navigation.push(EModalFirmwareUpdateRoutes.Install, {
                    result,
                  });
                  setWorkflowIsRunning(true);
                  await backgroundApiProxy.serviceFirmwareUpdate.startUpdateWorkflow(
                    {
                      backuped: true,
                      usbConnected: true,
                      releaseResult: result,
                    },
                  );

                  // Never let analytics context reading break the update flow
                  const trackingInfo =
                    await backgroundApiProxy.serviceFirmwareUpdate
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
                    durationMs: trackingInfo?.durationMs,
                    totalDurationMs: trackingInfo?.totalDurationMs,
                    transferredBytes: trackingInfo?.transferredBytes,
                    totalBytes: trackingInfo?.totalBytes,
                    rateBytesPerSecond: trackingInfo?.rateBytesPerSecond,
                    transferElapsedMs: trackingInfo?.transferElapsedMs,
                  });

                  const { fromFirmwareType, toFirmwareType } =
                    updateFirmwareInfo ?? {
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
                  const trackingInfo =
                    await backgroundApiProxy.serviceFirmwareUpdate
                      .getUpdateWorkflowTrackingInfo()
                      .catch(() => undefined);
                  defaultLogger.update.firmware.firmwareUpdateResult({
                    deviceType: result?.deviceType,
                    transportType: hardwareTransportType,
                    updateFlow: useV2FirmwareUpdateFlow ? 'v2' : 'v1',
                    firmwareVersions: parseFirmwareVersions(result),
                    fromFirmwareType: updateFirmwareInfo?.fromFirmwareType,
                    toFirmwareType: updateFirmwareInfo?.toFirmwareType,
                    status:
                      failureType === 'cancelled' ? 'cancelled' : 'failed',
                    failureType,
                    errorCode: resolveFirmwareUpdateErrorCode(err),
                    retryCount: trackingInfo?.retryCount,
                    durationMs: trackingInfo?.durationMs,
                    totalDurationMs: trackingInfo?.totalDurationMs,
                    transferredBytes: trackingInfo?.transferredBytes,
                    totalBytes: trackingInfo?.totalBytes,
                    rateBytesPerSecond: trackingInfo?.rateBytesPerSecond,
                    transferElapsedMs: trackingInfo?.transferElapsedMs,
                  });
                } finally {
                  if (shouldResetWorkflowRunningInUi) {
                    setWorkflowIsRunning(false);
                  }
                }
              }
            : undefined
        }
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_continue,
        })}
        showCancelButton={false}
      />
    </Stack>
  );
}
