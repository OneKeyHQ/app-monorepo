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

import {
  getFirmwareUpdateSessionStartInput,
  useFirmwareUpdateSession,
} from '../hooks/useFirmwareUpdateSession';

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
  const firmwareUpdateSession = useFirmwareUpdateSession();
  const projection = firmwareUpdateSession.projection;
  const isTransactionSession = Boolean(projection);
  const isDone =
    projection?.phase === 'COMPLETED' ||
    stepInfo.step === EFirmwareUpdateSteps.updateDone;
  const needOnboarding = (() => {
    if (isTransactionSession) {
      return Boolean(
        result?.updateInfos.firmware?.fromFirmwareType &&
        result.updateInfos.firmware.toFirmwareType &&
        result.updateInfos.firmware.fromFirmwareType !==
          result.updateInfos.firmware.toFirmwareType,
      );
    }
    if (stepInfo.step === EFirmwareUpdateSteps.updateDone) {
      return stepInfo.payload?.needOnboarding ?? false;
    }
    return false;
  })();

  const content = useMemo(() => {
    if (isDone) {
      return (
        <FirmwareUpdateDone result={result} needOnboarding={needOnboarding} />
      );
    }
    if (
      projection &&
      ['FAILED', 'PAUSED', 'RECOVERY_UNSUPPORTED'].includes(projection.phase)
    ) {
      return (
        <FirmwareUpdateErrors.TransactionError
          projection={projection}
          onRetry={async () => {
            const transactionInput = result
              ? getFirmwareUpdateSessionStartInput(result)
              : undefined;
            if (!transactionInput) return;
            if (projection.revision === 0) {
              const startResult =
                await firmwareUpdateSession.start(transactionInput);
              if (startResult.engine === 'transaction') {
                await firmwareUpdateSession.execute({
                  sessionId: startResult.projection.sessionId,
                  connectId: transactionInput.connectId,
                });
              }
              return;
            }
            await firmwareUpdateSession.resume({
              sessionId: projection.sessionId,
              connectId: transactionInput.connectId,
            });
          }}
        />
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
        result={result}
        key={progressBarKey}
      />
    );
  }, [
    firmwareUpdateSession,
    isDone,
    needOnboarding,
    progressBarKey,
    projection,
    result,
    retryInfo,
    tipMessage,
  ]);
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
