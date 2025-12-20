import { useEffect, useMemo, useRef, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import type { IFirmwareUpdateRetry } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateRetryAtom,
  useFirmwareUpdateStepInfoAtom,
  useHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  EFirmwareUpdateTipMessages,
  ICheckAllFirmwareReleaseResult,
} from '@onekeyhq/shared/types/device';

import { FirmwareUpdateDone } from './FirmwareUpdateDone';
import { FirmwareUpdateErrors } from './FirmwareUpdateErrors';
import { FirmwareUpdateProgressBar } from './FirmwareUpdateProgressBar';

export function FirmwareInstallingViewBase({
  result,
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
  const [stepInfo] = useFirmwareUpdateStepInfoAtom();
  const isDone = stepInfo.step === EFirmwareUpdateSteps.updateDone;
  const needOnboarding =
    stepInfo.step === EFirmwareUpdateSteps.updateDone
      ? stepInfo.payload?.needOnboarding ?? false
      : false;

  const content = useMemo(() => {
    if (isDone) {
      return (
        <FirmwareUpdateDone result={result} needOnboarding={needOnboarding} />
      );
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
  }, [isDone, needOnboarding, progressBarKey, result, retryInfo, tipMessage]);
  return <Stack>{content}</Stack>;
}

export function FirmwareInstallingView({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
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
        tipMessage={lastFirmwareTipMessage}
        retryInfo={
          stepInfo.step === EFirmwareUpdateSteps.updateStart
            ? undefined
            : retryInfo
        }
        progressBarKey={lastUpdateTimeRef.current}
      />
    </>
  );
}
