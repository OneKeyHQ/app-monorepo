import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isNumber } from 'lodash';

import {
  Button,
  Progress,
  SizableText,
  Skeleton,
  Stack,
} from '@onekeyhq/components';
import {
  EFirmwareUpdateSteps,
  EHardwareUiStateAction,
  useFirmwareUpdateRetryAtom,
  useFirmwareUpdateStepInfoAtom,
  useHardwareUiStateAtom,
  useHardwareUiStateCompletedAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { IDeviceFirmwareType } from '@onekeyhq/shared/types/device';
import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePrevious } from '../../../hooks/usePrevious';

type IProgressType =
  | EFirmwareUpdateTipMessages
  | 'checking'
  | 'installing'
  | 'done';

type IProgressConfigItem = {
  type: IProgressType[];
  progress: () => number;
  progressMax?: () => number;
  //   title: (type: IProgressType) => string;
  desc: () => string;
};

const defaultDesc = () => `Checking device`;

const checkingMaxProgress = 10;

export function FirmwareUpdateProgressBarView({
  stepText,
  title,
  fromVersion: versionFrom,
  toVersion: versionTo,
  progress,
  desc,
}: {
  stepText: string | undefined;
  title: string;
  fromVersion: string | undefined;
  toVersion: string | undefined;
  progress: number | null | undefined;
  desc: string;
}) {
  const phaseStepView = useMemo(() => {
    if (!stepText) {
      return <Skeleton width={120} height={16} />;
    }
    return (
      <SizableText size="$bodyMd" color="$textSubdued">
        {stepText}
      </SizableText>
    );
  }, [stepText]);

  const versionView = useMemo(() => {
    if (!versionTo) {
      return <Skeleton width={80} height={16} />;
    }
    return (
      <SizableText>
        {versionFrom ? `${versionFrom} - ` : ''} {versionTo}
      </SizableText>
    );
  }, [versionFrom, versionTo]);

  return (
    <Stack py="$6">
      {phaseStepView}
      <SizableText size="$heading2xl" my="$3">
        {title}
      </SizableText>
      {versionView}
      <Stack mt="$12" mb="$3">
        <Progress value={progress} />
      </Stack>
      <SizableText size="$bodyLg" color="$textSubdued">
        {desc}
      </SizableText>
    </Stack>
  );
}

export function FirmwareUpdateProgressBar({
  lastFirmwareTipMessage,
  isDone,
}: {
  lastFirmwareTipMessage: EFirmwareUpdateTipMessages | undefined;
  isDone?: boolean;
}) {
  const [stepInfo] = useFirmwareUpdateStepInfoAtom();
  const [state] = useHardwareUiStateAtom();
  const [stateFull] = useHardwareUiStateCompletedAtom();
  const [progress, setProgress] = useState(1);
  const [retryInfo] = useFirmwareUpdateRetryAtom();

  const progressRef = useRef(progress);
  progressRef.current = progress;

  const progressMaxRef = useRef(checkingMaxProgress);

  const [desc, setDesc] = useState(defaultDesc());

  const firmwareType: IDeviceFirmwareType | undefined = useMemo(() => {
    if (stepInfo?.step === EFirmwareUpdateSteps.installing) {
      return (
        stepInfo.payload.installingTarget?.updateInfo?.firmwareType || undefined
      );
    }
  }, [stepInfo.payload, stepInfo?.step]);

  const firmwareVersionInfo = useMemo(() => {
    if (stepInfo?.step === EFirmwareUpdateSteps.installing) {
      return {
        fromVersion:
          stepInfo.payload.installingTarget?.updateInfo.fromVersion ||
          undefined,
        toVersion:
          stepInfo.payload.installingTarget?.updateInfo.toVersion || undefined,
      };
    }
  }, [stepInfo.payload, stepInfo?.step]);

  const firmwareTipMessage = state?.payload?.firmwareTipData?.message;
  const firmwareProgress = state?.payload?.firmwareProgress;
  const isConfirmOnDevice = deviceUtils.isConfirmOnDeviceAction(state);

  const isUpdatingResource = [
    EFirmwareUpdateTipMessages.CheckLatestUiResource,
    EFirmwareUpdateTipMessages.DownloadLatestUiResource,
    EFirmwareUpdateTipMessages.DownloadLatestUiResourceSuccess,
    EFirmwareUpdateTipMessages.UpdateSysResource,
    EFirmwareUpdateTipMessages.UpdateSysResourceSuccess,
  ].includes(lastFirmwareTipMessage as any);

  const prevFirmwareType = usePrevious(firmwareType);

  const firmwareProgressRef = useRef(firmwareProgress);
  firmwareProgressRef.current = firmwareProgress;

  const installProgressList = useRef<string[]>([]);

  const phaseStepText = useMemo(() => {
    // TODO use <Skeleton width={250} height={24} />
    // let phaseStepText = 'Step */*';
    let text = '';
    if (stepInfo?.step === EFirmwareUpdateSteps.installing) {
      if (stepInfo?.payload?.installingTarget) {
        const { totalPhase, currentPhase } = stepInfo.payload.installingTarget;
        text = `Step ${
          totalPhase.findIndex((item) => item === currentPhase) + 1
        }/${totalPhase.length}`;
      }
    }
    return text;
  }, [stepInfo]);

  const titleText = useMemo(() => {
    let text = 'Preparing...';
    if (lastFirmwareTipMessage) {
      text = 'Updating...';
    }
    if (firmwareType) {
      // type IDeviceFirmwareType = 'firmware' | 'ble' | 'bootloader';
      text = `Updating ${firmwareType}...`;
      if (firmwareType === 'ble') {
        text = `Updating bluetooth...`;
      }
    }
    if (isDone) {
      text = `Done`;
    }
    return text;
  }, [firmwareType, isDone, lastFirmwareTipMessage]);

  const updateProgress = useCallback(
    (type: IProgressType) => {
      const progressConfig: IProgressConfigItem[] = [
        {
          type: ['checking'],
          progress: () => 1,
          progressMax: () => checkingMaxProgress,
          desc: () => defaultDesc(),
        },
        {
          type: [EFirmwareUpdateTipMessages.CheckLatestUiResource],
          progress: () => 2,
          desc: () => `CheckLatestUiResource`,
        },
        {
          type: [EFirmwareUpdateTipMessages.DownloadLatestUiResource],
          progress: () => 3,
          desc: () => `DownloadLatestUiResource`,
        },
        {
          type: [EFirmwareUpdateTipMessages.DownloadLatestUiResourceSuccess],
          progress: () => 5,
          desc: () => `DownloadLatestUiResourceSuccess`,
        },
        {
          type: [EFirmwareUpdateTipMessages.UpdateSysResource],
          progress: () => 7,
          desc: () => `UpdateSysResource`,
        },
        {
          type: [EFirmwareUpdateTipMessages.UpdateSysResourceSuccess],
          progress: () => 9,
          desc: () => `UpdateSysResourceSuccess`,
        },
        {
          type: [EFirmwareUpdateTipMessages.AutoRebootToBootloader],
          progress: () => 10,
          desc: () => `Reboot to bootloader mode`,
        },
        {
          type: [EFirmwareUpdateTipMessages.GoToBootloaderSuccess],
          progress: () => 12,
          desc: () => `Reboot success, downloading`,
        },
        {
          type: [
            EFirmwareUpdateTipMessages.DownloadFirmware,
            EFirmwareUpdateTipMessages.DownloadLatestBootloaderResource,
          ],
          progress: () => 14,
          desc: () => `Downloading`,
        },
        {
          type: [
            EFirmwareUpdateTipMessages.DownloadFirmwareSuccess,
            EFirmwareUpdateTipMessages.DownloadLatestBootloaderResourceSuccess,
          ],
          progress: () => 20,
          desc: () => `Download success`,
        },
        {
          type: [EFirmwareUpdateTipMessages.FirmwareEraseSuccess],
          progress: () => 25,
          desc: () => `Transferring data`,
        },
        {
          type: [
            'installing',
            // EFirmwareUpdateTipMessages.StartTransferData, // don't need this, use firmwareProgress instead
            // EFirmwareUpdateTipMessages.InstallingFirmware,
          ],
          progress: () => {
            const startAt = 30;
            let newProgress =
              startAt +
              (firmwareProgressRef.current ?? 0) * ((100 - startAt) / 100);
            if (newProgress >= 99) {
              newProgress = 99;
            }
            return newProgress;
          },
          desc: () => {
            if (firmwareProgressRef.current === 100) {
              return `Data transferred, installing...`;
            }
            return `Transferring data`;
          },
        },
        {
          type: ['done'],
          progress: () => 100,
          desc: () => `Firmware Update Done!`,
        },
      ];
      const index = progressConfig.findIndex((c) => c.type.includes(type));
      if (index >= 0) {
        const item = progressConfig[index];
        const itemProgress = item.progress();

        const currentProgress = progressRef.current;
        setProgress(() => {
          const newProgress = Math.max(itemProgress, currentProgress);
          console.log('setProgress>>>>', {
            newProgress,
            itemProgress,
            currentProgress,
            type,
          });
          progressRef.current = newProgress;
          return newProgress;
        });

        setDesc(item.desc());
        const nextItem = progressConfig[index + 1];
        const maxProgress = item?.progressMax?.() ?? nextItem?.progress();
        if (maxProgress) {
          progressMaxRef.current = maxProgress;
        } else {
          progressMaxRef.current = 99;
        }
      }
    },
    [
      // do not add any deps here, use ref instead
    ],
  );

  const updateProgressRef = useRef(updateProgress);
  updateProgressRef.current = updateProgress;

  console.log(
    'progressRef.current >>>',
    progressRef.current,
    lastFirmwareTipMessage,
  );

  useEffect(() => {
    console.log('firmwareType>>>>', { firmwareType, prevFirmwareType });
    // reset progress when retry clicked
    if (retryInfo) {
      return;
    }
    if (firmwareType && prevFirmwareType && firmwareType !== prevFirmwareType) {
      // install another firmware, reset progress
      setProgress(1);
      progressRef.current = 1;
      progressMaxRef.current = 99;
      updateProgressRef.current('checking');
    }
  }, [firmwareType, prevFirmwareType, retryInfo]);

  useEffect(() => {
    if (stepInfo?.step === EFirmwareUpdateSteps.updateStart || !firmwareType) {
      setDesc(defaultDesc());
    }
  }, [firmwareType, stepInfo?.step]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (retryInfo || isDone) {
        return;
      }
      if (isConfirmOnDevice) return;
      const currentProgress = progressRef.current;
      setProgress(() => {
        if (currentProgress >= progressMaxRef.current)
          return progressMaxRef.current;
        if (currentProgress >= 99) return 99;
        const newProgress = Math.min(
          currentProgress + 1,
          progressMaxRef.current,
          99,
        );
        progressRef.current = newProgress;
        return newProgress;
      });
    }, 2000);
    return () => {
      clearInterval(timer);
    };
  }, [firmwareType, isConfirmOnDevice, isDone, retryInfo]);

  useEffect(() => {
    if (isDone) {
      setTimeout(() => {
        updateProgressRef.current('done');
      }, 1000);
    }
  }, [isDone]);

  useEffect(() => {
    if (firmwareTipMessage) {
      installProgressList.current.push(firmwareTipMessage);
    }
  }, [firmwareTipMessage]);

  useEffect(() => {
    if (isNumber(firmwareProgress)) {
      updateProgressRef.current('installing');
    }
  }, [firmwareProgress]);

  useEffect(() => {
    // close "ConfirmOnDevice" toast when installing firmware of touch
    // lastFirmwareTipMessage === EFirmwareUpdateTipMessages.InstallingFirmware
    //
    if (stateFull?.action === EHardwareUiStateAction.CLOSE_UI_WINDOW) {
      void backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
        skipDeviceCancel: true,
        connectId: undefined,
      });
    }
  }, [stateFull?.action]);

  useEffect(() => {
    if (lastFirmwareTipMessage) {
      updateProgressRef.current(lastFirmwareTipMessage);
    }
  }, [lastFirmwareTipMessage]);

  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const debugInfo = useMemo(() => {
    if (process.env.NODE_ENV !== 'production') {
      return (
        <Stack my="$6">
          <Button
            size="small"
            onPress={() => {
              setShowDebugInfo((v) => !v);
            }}
          >
            ProgressDebugInfo ({parseInt(progress.toFixed(), 10)}%)
          </Button>
          {showDebugInfo ? (
            <Stack>
              <SizableText>
                lastTipMessage:
                {lastFirmwareTipMessage} ({firmwareProgress ?? '--'}%)
              </SizableText>

              {installProgressList.current.map((item, index) => (
                <SizableText key={index}>
                  {index + 1}. {item}
                </SizableText>
              ))}
            </Stack>
          ) : null}
        </Stack>
      );
    }
  }, [firmwareProgress, lastFirmwareTipMessage, progress, showDebugInfo]);

  // if (isDone) {
  //   return <Stack>{debugInfo}</Stack>;
  // }

  return (
    <Stack>
      <FirmwareUpdateProgressBarView
        stepText={phaseStepText}
        title={titleText}
        progress={progress}
        desc={desc}
        fromVersion={firmwareVersionInfo?.fromVersion}
        toVersion={firmwareVersionInfo?.toVersion}
      />
      {debugInfo}
    </Stack>
  );
}
