import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isNumber } from 'lodash';

import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateRetryAtom,
  useFirmwareUpdateStepInfoAtom,
  useHardwareUiStateAtom,
  useHardwareUiStateCompletedAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';
import { EHardwareUiStateAction } from '@onekeyhq/shared/types/hardwareUi';

import { useWebUsbReconnectRequests } from '../components/FirmwareUpdatePromptWebUsbDevice';

import {
  getFirmwareUpdateStage,
  getRemainingTimeBucket,
  sliceOverallProgress,
} from './firmwareUpdateInstallViewModel';
import {
  calculateProgressInRange,
  getFirmwareTransferEtaMs,
  normalizeFirmwareUpdateProgressType,
  resolveFirmwareInstallProgress,
} from './firmwareUpdateProgressUtils';

import type {
  IFirmwareUpdateProgressType,
  IFirmwareUpdateStage,
  IRemainingTimeBucket,
} from './firmwareUpdateInstallViewModel';

export type IWebUsbRequestType = 'bootloader' | 'switchFirmware';

type IPhaseProgressContext = {
  firmwareProgress: number | undefined;
  installPhaseProgress: number | undefined;
  currentProgress: number;
};

/**
 * Percent inside the current part for the legacy (V1) task sequence. The
 * numbers mirror the old per-phase bar so the pacing stays familiar.
 */
function getLegacyPhaseProgress(
  type: IFirmwareUpdateProgressType,
  ctx: IPhaseProgressContext,
): number | undefined {
  switch (type) {
    case 'checking':
      return 1;
    case EFirmwareUpdateTipMessages.CheckLatestUiResource:
      return 2;
    case EFirmwareUpdateTipMessages.DownloadLatestUiResource:
      return 3;
    case EFirmwareUpdateTipMessages.DownloadLatestUiResourceSuccess:
      return 5;
    case EFirmwareUpdateTipMessages.UpdateSysResource:
      return 7;
    case EFirmwareUpdateTipMessages.UpdateSysResourceSuccess:
      return 9;
    case EFirmwareUpdateTipMessages.AutoRebootToBootloader:
      return 10;
    case EFirmwareUpdateTipMessages.SelectDeviceInBootloaderForWebDevice:
      return 11;
    case EFirmwareUpdateTipMessages.GoToBootloaderSuccess:
      return 12;
    case EFirmwareUpdateTipMessages.DownloadFirmware:
    case EFirmwareUpdateTipMessages.DownloadLatestBootloaderResource:
      return 14;
    case EFirmwareUpdateTipMessages.DownloadFirmwareSuccess:
    case EFirmwareUpdateTipMessages.DownloadLatestBootloaderResourceSuccess:
      return 20;
    case EFirmwareUpdateTipMessages.FirmwareEraseSuccess:
      return 25;
    case 'installing':
    case EFirmwareUpdateTipMessages.StartTransferData:
    case EFirmwareUpdateTipMessages.InstallingFirmware:
      return Math.min(30 + (ctx.firmwareProgress ?? 0) * 0.7, 99);
    case 'done':
      return 100;
    default:
      return undefined;
  }
}

/** Percent for the single-call (V2 / Protocol V2) flow. */
function getUnifiedProgress(
  type: IFirmwareUpdateProgressType,
  ctx: IPhaseProgressContext,
): number | undefined {
  switch (type) {
    case 'checking':
      return 1;
    case EFirmwareUpdateTipMessages.StartDownloadFirmware:
      return 5;
    case EFirmwareUpdateTipMessages.AutoRebootToBootloader:
      return 10;
    case EFirmwareUpdateTipMessages.SelectDeviceInBootloaderForWebDevice:
      return 11;
    case EFirmwareUpdateTipMessages.SwitchFirmwareReconnectDevice:
    case EFirmwareUpdateTipMessages.ConfirmOnDevice:
      return ctx.currentProgress;
    case EFirmwareUpdateTipMessages.StartTransferData:
      return calculateProgressInRange({
        startAt: 12,
        maxAt: 50,
        currentProgress: ctx.firmwareProgress,
      });
    case EFirmwareUpdateTipMessages.FirmwareUpdating:
    case 'installing':
      return calculateProgressInRange({
        startAt: 50,
        maxAt: 90,
        currentProgress: resolveFirmwareInstallProgress({
          installPhaseProgress: ctx.installPhaseProgress,
          firmwareProgress: ctx.firmwareProgress,
        }),
      });
    case EFirmwareUpdateTipMessages.FirmwareUpdateCompleted:
      return 99;
    case 'done':
      return 100;
    default:
      return undefined;
  }
}

export function useFirmwareUpdateInstallState({ isDone }: { isDone: boolean }) {
  const [stepInfo] = useFirmwareUpdateStepInfoAtom();
  const [retryInfo] = useFirmwareUpdateRetryAtom();
  const [state] = useHardwareUiStateAtom();
  const [completedState] = useHardwareUiStateCompletedAtom();

  const [progress, setProgress] = useState(1);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const [stage, setStage] = useState<IFirmwareUpdateStage>('preparing');

  // The SDK clears its tip between events; keep the last one so the stage
  // word and error copy can still refer to it.
  const firmwareTipMessage = state?.payload?.firmwareTipData?.message as
    | EFirmwareUpdateTipMessages
    | undefined;
  const [lastFirmwareTipMessage, setLastFirmwareTipMessage] = useState<
    EFirmwareUpdateTipMessages | undefined
  >();
  useEffect(() => {
    if (firmwareTipMessage) {
      setLastFirmwareTipMessage(firmwareTipMessage);
    }
  }, [firmwareTipMessage]);

  // A retry or restart reuses this hook instance, so a new attempt must drop
  // the bar back to the start instead of holding the failed attempt's percent.
  const startAtTime =
    stepInfo.step === EFirmwareUpdateSteps.updateStart
      ? stepInfo.payload.startAtTime
      : undefined;
  const seenStartAtTimeRef = useRef(startAtTime);
  useEffect(() => {
    if (
      startAtTime === undefined ||
      startAtTime === seenStartAtTimeRef.current
    ) {
      return;
    }
    seenStartAtTimeRef.current = startAtTime;
    progressRef.current = 1;
    setProgress(1);
    setStage('preparing');
    setLastFirmwareTipMessage(undefined);
  }, [startAtTime]);

  useEffect(() => {
    if (!retryInfo) {
      return;
    }
    progressRef.current = 1;
    setProgress(1);
    setStage('preparing');
  }, [retryInfo]);

  // The active state may be cleared when the confirmation dialog closes.
  // Use the latest completed event so the page can still consume it.
  let progressState;
  if (state?.action === EHardwareUiStateAction.FIRMWARE_PROGRESS) {
    progressState = state;
  } else if (
    completedState?.action === EHardwareUiStateAction.FIRMWARE_PROGRESS
  ) {
    progressState = completedState;
  }
  const firmwareProgress = progressState?.payload?.firmwareProgress;
  const firmwareProgressType = progressState?.payload?.firmwareProgressType;
  const firmwareInstallPhase = progressState?.payload?.firmwareInstallPhase;
  const firmwareInstallPhaseProgress =
    progressState?.payload?.firmwareInstallPhaseProgress;
  const firmwareTransferMetrics =
    progressState?.payload?.firmwareTransferMetrics ??
    state?.payload?.firmwareTransferMetrics ??
    completedState?.payload?.firmwareTransferMetrics;

  const firmwareProgressRef = useRef(firmwareProgress);
  firmwareProgressRef.current = firmwareProgress;
  const installPhaseProgressRef = useRef(firmwareInstallPhaseProgress);
  installPhaseProgressRef.current = firmwareInstallPhaseProgress;
  const installPhaseRef = useRef(firmwareInstallPhase);
  installPhaseRef.current = firmwareInstallPhase;

  // Legacy multi-part sequence: bootloader → firmware → Bluetooth.
  const legacyPhase = useMemo(() => {
    if (stepInfo.step !== EFirmwareUpdateSteps.installing) {
      return undefined;
    }
    const target = stepInfo.payload?.installingTarget;
    if (!target?.totalPhase?.length) {
      return undefined;
    }
    const index = target.totalPhase.findIndex(
      (phase) => phase === target.currentPhase,
    );
    return {
      phaseIndex: Math.max(index, 0),
      totalPhases: target.totalPhase.length,
    };
  }, [stepInfo]);
  const legacyPhaseRef = useRef(legacyPhase);
  legacyPhaseRef.current = legacyPhase;

  const updateProgress = useCallback((type: IFirmwareUpdateProgressType) => {
    const normalizedType = normalizeFirmwareUpdateProgressType(type);
    const ctx: IPhaseProgressContext = {
      firmwareProgress: firmwareProgressRef.current,
      installPhaseProgress: installPhaseProgressRef.current,
      currentProgress: progressRef.current,
    };
    const phase = legacyPhaseRef.current;
    let next: number | undefined;
    if (phase) {
      const phaseProgress = getLegacyPhaseProgress(normalizedType, ctx);
      if (phaseProgress !== undefined) {
        next = sliceOverallProgress({ ...phase, phaseProgress });
      }
    } else {
      next = getUnifiedProgress(normalizedType, ctx);
    }
    if (next !== undefined) {
      setProgress(() => {
        const value = Math.max(next, progressRef.current);
        progressRef.current = value;
        return value;
      });
    }
    setStage(
      getFirmwareUpdateStage({
        progressType: normalizedType,
        installPhase: installPhaseRef.current,
      }),
    );
  }, []);
  const updateProgressRef = useRef(updateProgress);
  updateProgressRef.current = updateProgress;

  useEffect(() => {
    if (!retryInfo && lastFirmwareTipMessage) {
      updateProgressRef.current(lastFirmwareTipMessage);
    }
  }, [lastFirmwareTipMessage, retryInfo]);

  useEffect(() => {
    if (isDone) {
      setTimeout(() => {
        updateProgressRef.current('done');
      });
    }
  }, [isDone]);

  useEffect(() => {
    if (stepInfo.step === EFirmwareUpdateSteps.installing) {
      // Wait for a real tip or numeric progress. A synthetic 'installing'
      // type maps to 50–90 and cannot decrease.
      return;
    }
    if (stepInfo.step !== EFirmwareUpdateSteps.updateStart) {
      return;
    }
    if (stepInfo.payload.isDownloadingArtifacts) {
      updateProgressRef.current(
        EFirmwareUpdateTipMessages.StartDownloadFirmware,
      );
      return;
    }
    updateProgressRef.current('checking');
  }, [stepInfo]);

  useEffect(() => {
    if (retryInfo) {
      return;
    }
    if (
      isNumber(firmwareProgress) ||
      (firmwareProgressType === 'installingFirmware' &&
        isNumber(firmwareInstallPhaseProgress))
    ) {
      if (
        firmwareProgress === 0 &&
        firmwareProgressType === 'installingFirmware' &&
        lastFirmwareTipMessage === EFirmwareUpdateTipMessages.ConfirmOnDevice
      ) {
        return;
      }
      updateProgressRef.current(
        firmwareProgressType === 'installingFirmware'
          ? 'installing'
          : EFirmwareUpdateTipMessages.StartTransferData,
      );
    }
  }, [
    firmwareInstallPhase,
    firmwareInstallPhaseProgress,
    firmwareProgress,
    firmwareProgressType,
    lastFirmwareTipMessage,
    retryInfo,
  ]);

  // Device-side confirmation or PIN entry pauses everything visible here.
  const isWaitingForDevice = deviceUtils.isConfirmOnDeviceAction(state);
  let displayStage: IFirmwareUpdateStage = stage;
  if (isWaitingForDevice) {
    displayStage = 'waitingForDevice';
  }
  if (retryInfo) {
    displayStage = 'preparing';
  }

  const remainingTime = useMemo<IRemainingTimeBucket | undefined>(() => {
    if (firmwareProgressType !== 'transferData') {
      return undefined;
    }
    if (
      displayStage !== 'downloading' &&
      displayStage !== 'transferring' &&
      displayStage !== 'installing'
    ) {
      return undefined;
    }
    const etaMs = getFirmwareTransferEtaMs(firmwareTransferMetrics);
    return etaMs === undefined ? undefined : getRemainingTimeBucket(etaMs);
  }, [displayStage, firmwareProgressType, firmwareTransferMetrics]);

  const previousStepInfo = useWebUsbReconnectRequests();

  let webUsbRequest: IWebUsbRequestType | undefined;
  if (
    stepInfo.step === EFirmwareUpdateSteps.requestDeviceInBootloaderForWebDevice
  ) {
    webUsbRequest = 'bootloader';
  } else if (
    stepInfo.step ===
    EFirmwareUpdateSteps.requestDeviceForSwitchFirmwareWebDevice
  ) {
    webUsbRequest = 'switchFirmware';
  }

  return {
    progress,
    stage: displayStage,
    remainingTime,
    lastFirmwareTipMessage,
    webUsbRequest,
    previousStepInfo,
  };
}
