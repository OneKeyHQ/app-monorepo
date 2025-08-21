import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Checkbox, Dialog, Stack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateStepInfoAtom,
  useFirmwareUpdateWorkflowRunningAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { parseFirmwareVersions } from '@onekeyhq/shared/src/logger/scopes/update/scenes/firmware';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalFirmwareUpdateRoutes } from '@onekeyhq/shared/src/routes';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

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
  const [checkValueList, setCheckValueList] = useState([
    {
      label: intl.formatMessage({
        id: ETranslations.update_i_have_backed_up_my_recovery_phrase,
      }),
      emoji: '✅',
      value: false,
    },
    {
      label: intl.formatMessage({
        id: platformEnv.isNative
          ? ETranslations.update_device_connected_via_bluetooth
          : ETranslations.update_device_connected_via_usb,
      }),
      emoji: platformEnv.isNative ? '📲' : '🔌',
      value: false,
    },
    // {
    //   label: intl.formatMessage({
    //     id: ETranslations.update_device_fully_charged,
    //   }),
    //   emoji: '🔋',
    //   value: false,
    // },
    ...(platformEnv.isNative
      ? []
      : [
          {
            label: intl.formatMessage({
              id: ETranslations.update_only_one_device_connected,
            }),
            emoji: '📱',
            value: false,
          },
          {
            label: intl.formatMessage({
              id: ETranslations.update_all_other_apps_closed,
            }),
            emoji: '🆗',
            value: false,
          },
        ]),
  ]);
  const onCheckChanged = useCallback(
    (checkValue: { value: boolean }) => {
      checkValue.value = !checkValue.value;
      setCheckValueList([...checkValueList]);
    },
    [checkValueList],
  );
  const isAllChecked = useMemo(
    () => checkValueList.every((x) => x.value),
    [checkValueList],
  );

  return (
    <Stack>
      <Stack>
        {checkValueList.map((checkValue) => (
          <Checkbox
            key={checkValue.label}
            value={checkValue.value}
            label={
              checkValue.value
                ? `${checkValue.label} ${checkValue.emoji}`
                : checkValue.label
            }
            onChange={() => onCheckChanged(checkValue)}
          />
        ))}
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
                try {
                  await dialog.close();
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
                    await backgroundApiProxy.serviceFirmwareUpdate.startUpdateWorkflowV2(
                      {
                        backuped: true,
                        usbConnected: true,
                        releaseResult: result,
                      },
                    );
                  } else {
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
                  }
                  defaultLogger.update.firmware.firmwareUpdateResult({
                    deviceType: result?.deviceType,
                    transportType: hardwareTransportType,
                    updateFlow: useV2FirmwareUpdateFlow ? 'v2' : 'v1',
                    firmwareVersions: parseFirmwareVersions(result),
                    status: 'success',
                  });

                  setStepInfo({
                    step: EFirmwareUpdateSteps.updateDone,
                    payload: undefined,
                  });
                } catch (error) {
                  const err = toPlainErrorObject(error as any);
                  setStepInfo({
                    step: EFirmwareUpdateSteps.error,
                    payload: {
                      error: err,
                    },
                  });
                  defaultLogger.update.firmware.firmwareUpdateResult({
                    deviceType: result?.deviceType,
                    transportType: hardwareTransportType,
                    updateFlow: useV2FirmwareUpdateFlow ? 'v2' : 'v1',
                    firmwareVersions: parseFirmwareVersions(result),
                    status: 'failed',
                    errorCode: err?.code,
                    errorMessage: err?.message,
                  });
                } finally {
                  setWorkflowIsRunning(false);
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
