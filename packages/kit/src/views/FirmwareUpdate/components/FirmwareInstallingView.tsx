import { useEffect, useRef, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateRetryAtom,
  useFirmwareUpdateStepInfoAtom,
  useHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';

import { FirmwareUpdateDone } from './FirmwareUpdateDone';
import { FirmwareUpdateErrors } from './FirmwareUpdateErrors';
import { FirmwareUpdateProgressBar } from './FirmwareUpdateProgressBar';
import { FirmwareUpdateWalletProfile } from './FirmwareUpdateWalletProfile';

export function FirmwareInstallingView({
  result,
  isDone,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
  isDone?: boolean;
}) {
  const [stepInfo] = useFirmwareUpdateStepInfoAtom();
  const [retryInfo] = useFirmwareUpdateRetryAtom();
  const [state] = useHardwareUiStateAtom();
  const installProgressText = useRef('');

  const lastUpdateTimeRef = useRef(0);
  if (stepInfo.step === EFirmwareUpdateSteps.updateStart) {
    lastUpdateTimeRef.current = stepInfo.payload.startAtTime;
  }

  const firmwareTipMessage = state?.payload?.firmwareTipData?.message;

  const [lastFirmwareTipMessage, setLastFirmwareTipMessage] = useState<
    EFirmwareUpdateTipMessages | undefined
  >();

  useEffect(() => {
    if (firmwareTipMessage) {
      setLastFirmwareTipMessage(firmwareTipMessage as any);
    }
  }, [firmwareTipMessage]);

  useEffect(() => {
    if (state?.payload?.firmwareTipData?.message)
      installProgressText.current = `${installProgressText.current},${state?.payload?.firmwareTipData?.message}`;
  }, [state?.payload?.firmwareTipData?.message]);

  return (
    <>
      <Stack>
        <FirmwareUpdateWalletProfile result={result} />

        <Stack my="$6">
          {retryInfo ? (
            <FirmwareUpdateErrors.InstallingErrors
              result={result}
              lastFirmwareTipMessage={lastFirmwareTipMessage}
            />
          ) : (
            <FirmwareUpdateProgressBar
              lastFirmwareTipMessage={lastFirmwareTipMessage}
              isDone={isDone}
              key={lastUpdateTimeRef.current}
            />
          )}
        </Stack>

        {isDone ? <FirmwareUpdateDone /> : null}
      </Stack>
    </>
  );
}
