import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Checkbox, Dialog, Stack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateStepInfoAtom,
  useFirmwareUpdateWorkflowRunningAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalFirmwareUpdateRoutes } from '@onekeyhq/shared/src/routes';
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
      emoji: '📲',
      value: false,
    },
    {
      label: intl.formatMessage({
        id: ETranslations.update_device_fully_charged,
      }),
      emoji: '🔋',
      value: false,
    },
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
      <Stack gap="$3" mr="$3">
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
                try {
                  await dialog.close();
                  setStepInfo({
                    step: EFirmwareUpdateSteps.updateStart,
                    payload: {
                      startAtTime: Date.now(),
                    },
                  });
                  navigation.navigate(EModalFirmwareUpdateRoutes.Install, {
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
                  setStepInfo({
                    step: EFirmwareUpdateSteps.updateDone,
                    payload: undefined,
                  });
                } catch (error) {
                  setStepInfo({
                    step: EFirmwareUpdateSteps.error,
                    payload: {
                      error: toPlainErrorObject(error as any),
                    },
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
      />
    </Stack>
  );
}
