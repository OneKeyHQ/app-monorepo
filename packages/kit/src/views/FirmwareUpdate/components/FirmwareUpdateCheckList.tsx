import { useState } from 'react';

import type { ICheckedState } from '@onekeyhq/components';
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

  const [val, setVal] = useState<ICheckedState[]>([false, false, false, false]);

  const isAllChecked = val.every((v) => v);

  return (
    <Stack>
      <SizableText size="$heading2xl" my="$8">
        Ready to Upgrade? Let’s Check You're all set 📝
      </SizableText>
      <Checkbox.Group
        label="Check All"
        listStyle={
          {
            // height: 200,
          }
        }
        options={[
          { label: "I've backed up my recovery phrase." },
          {
            label: platformEnv.isNative
              ? 'My device is connected via bluetooth.'
              : 'My device is connected via USB cable.',
          },
          { label: 'The device battery is fully charged.' },
          { label: 'Only one device is connected.' },
          { label: 'All other OneKey Apps and web upgrade tools are closed.' },
        ]}
        value={val}
        onChange={(value) => {
          setVal(value);
        }}
      />
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
