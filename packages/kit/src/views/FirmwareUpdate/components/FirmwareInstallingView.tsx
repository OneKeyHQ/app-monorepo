import { useEffect, useMemo, useRef, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate';
import type { IFirmwareUpdateRetry } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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

export function FirmwareInstallingViewBase({
  result,
  isDone,
  tipMessage,
  retryInfo,
  progressBarKey,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
  isDone?: boolean;
  tipMessage?: EFirmwareUpdateTipMessages | undefined;
  retryInfo?: IFirmwareUpdateRetry | undefined;
  progressBarKey?: number;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const profile = <FirmwareUpdateWalletProfile result={result} />;

  const content = useMemo(() => {
    if (isDone) {
      return <FirmwareUpdateDone result={result} />;
    }
    if (retryInfo) {
      return (
        <FirmwareUpdateErrors.InstallingErrors
          retryInfo={retryInfo}
          result={result}
          lastFirmwareTipMessage={tipMessage}
        />
      );
    }
    return (
      <FirmwareUpdateProgressBar
        lastFirmwareTipMessage={tipMessage}
        isDone={isDone}
        key={progressBarKey}
      />
    );
  }, [isDone, progressBarKey, result, retryInfo, tipMessage]);
  return (
    <Stack>
      {/* {profile} */}
      {content}
    </Stack>
  );
}

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

  return (
    <>
      <FirmwareInstallingViewBase
        result={result}
        isDone={isDone}
        tipMessage={lastFirmwareTipMessage}
        retryInfo={retryInfo}
        progressBarKey={lastUpdateTimeRef.current}
      />
    </>
  );
}
