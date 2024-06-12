import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Checkbox, SizableText, Stack } from '@onekeyhq/components';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateStepInfoAtom,
  useFirmwareUpdateWorkflowRunningAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { FirmwareUpdatePageFooter } from './FirmwareUpdatePageLayout';

export function FirmwareUpdateCheckList({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const intl = useIntl();
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
      <SizableText size="$heading2xl" my="$8">
        {intl.formatMessage({
          id: ETranslations.update_ready_to_upgrade_checklist,
        })}
      </SizableText>
      <Stack space="$3">
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
      <FirmwareUpdatePageFooter
        confirmButtonProps={{
          disabled: !isAllChecked,
        }}
        onConfirm={
          result
            ? async () => {
                if (!result) {
                  return;
                }
                try {
                  setStepInfo({
                    step: EFirmwareUpdateSteps.updateStart,
                    payload: {
                      startAtTime: Date.now(),
                    },
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
        onConfirmText="Continue"
      />
    </Stack>
  );
}
