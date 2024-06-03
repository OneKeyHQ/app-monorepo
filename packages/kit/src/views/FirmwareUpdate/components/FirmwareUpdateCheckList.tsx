import { useCallback, useMemo, useState } from 'react';

import { Checkbox, SizableText, Stack } from '@onekeyhq/components';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateStepInfoAtom,
  useFirmwareUpdateWorkflowRunningAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { FirmwareUpdatePageFooter } from './FirmwareUpdatePageLayout';

export function FirmwareUpdateCheckList({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const [, setStepInfo] = useFirmwareUpdateStepInfoAtom();
  const [, setWorkflowIsRunning] = useFirmwareUpdateWorkflowRunningAtom();

  const [checkValueList, setCheckValueList] = useState([
    {
      label: "I've backed up my recovery phrase.",
      emoji: '✅',
      value: false,
    },
    {
      label: platformEnv.isNative
        ? 'My device is connected via bluetooth.'
        : 'My device is connected via USB cable.',
      emoji: '📲',
      value: false,
    },
    {
      label: 'The device battery is fully charged.',
      emoji: '🔋',
      value: false,
    },
    {
      label: 'Only one device is connected.',
      emoji: '📱',
      value: false,
    },
    {
      label: 'All other OneKey Apps and web upgrade tools are closed.',
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
        Ready to Upgrade? Let’s Check You're all set 📝
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
