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

import { FirmwareUpdateErrorV2 } from './FirmwareUpdateErrorV2';
import { FirmwareUpdateProgressBarV2 } from './FirmwareUpdateProgressBarV2';

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
  const [resetKey, setResetKey] = useState(Date.now());
  const firmwareUpdateSession = useFirmwareUpdateSession();
  const projection = firmwareUpdateSession.projection;

  const content = useMemo(() => {
    if (
      projection &&
      ['FAILED', 'PAUSED', 'RECOVERY_UNSUPPORTED'].includes(projection.phase)
    ) {
      return (
        <FirmwareUpdateErrorV2
          retryInfo={undefined}
          result={result}
          lastFirmwareTipMessage={tipMessage}
          transactionProjection={projection}
          onTransactionRetry={async () => {
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
      console.log(
        'FirmwareInstallingViewBase ====>>>>: retryInfo: ',
        retryInfo,
      );
    }
    return (
      <>
        <FirmwareUpdateProgressBarV2
          result={result}
          lastFirmwareTipMessage={tipMessage}
          isDone={isDone}
          key={`${String(progressBarKey)}-${resetKey}`}
        />
        <FirmwareUpdateErrorV2
          retryInfo={retryInfo}
          result={result}
          lastFirmwareTipMessage={tipMessage}
          onRetryBefore={() => {
            setResetKey(Date.now());
          }}
        />
      </>
    );
  }, [
    firmwareUpdateSession,
    isDone,
    progressBarKey,
    projection,
    resetKey,
    result,
    retryInfo,
    tipMessage,
  ]);
  return <Stack>{content}</Stack>;
}

export function FirmwareInstallingViewV2({
  result,
  isDone,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
  isDone?: boolean;
}) {
  const [stepInfo] = useFirmwareUpdateStepInfoAtom();
  const [retryInfo] = useFirmwareUpdateRetryAtom();
  const [state] = useHardwareUiStateAtom();
  const firmwareUpdateSession = useFirmwareUpdateSession();

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
      console.log(
        'FirmwareInstallingViewV2 receive firmwareTipMessage: ',
        firmwareTipMessage,
      );
      setLastFirmwareTipMessage(firmwareTipMessage as any);
    }
  }, [firmwareTipMessage]);

  return (
    <>
      <FirmwareInstallingViewBase
        result={result}
        isDone={
          firmwareUpdateSession.projection?.phase === 'COMPLETED' || isDone
        }
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
