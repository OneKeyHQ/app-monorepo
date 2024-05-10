import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isNumber } from 'lodash';

import { Progress, SizableText, Stack } from '@onekeyhq/components';
import {
  EFirmwareUpdateSteps,
  EHardwareUiStateAction,
  useFirmwareUpdateRetryAtom,
  useFirmwareUpdateStepInfoAtom,
  useHardwareUiStateAtom,
  useHardwareUiStateCompletedAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
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

  const progressMaxRef = useRef(99);

  const [desc, setDesc] = useState(defaultDesc());

  const firmwareType = useMemo(() => {
    if (stepInfo?.step === EFirmwareUpdateSteps.installing) {
      return (
        stepInfo.payload.installingTarget?.updateInfo?.firmwareType || undefined
      );
    }
  }, [stepInfo.payload, stepInfo?.step]);

  const firmwareVersion = useMemo(() => {
    if (stepInfo?.step === EFirmwareUpdateSteps.installing) {
      return (
        stepInfo.payload.installingTarget?.updateInfo.toVersion || undefined
      );
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

  const titleView = useMemo(() => {
    let text = 'Preparing...';
    if (firmwareType) {
      text = `Updating ${firmwareType} v${firmwareVersion || ''}...`;
    }
    if (isUpdatingResource) {
      text = `Updating resources v${firmwareVersion || ''}...`;
    }
    if (isDone) {
      text = `Done`;
    }
    return (
      <SizableText>
        {text} ({parseInt(progress.toFixed(), 10)}%)
      </SizableText>
    );
  }, [firmwareType, firmwareVersion, isDone, isUpdatingResource, progress]);

  const updateProgress = useCallback(
    (type: IProgressType) => {
      const progressConfig: IProgressConfigItem[] = [
        {
          type: ['checking'],
          progress: () => 1,
          progressMax: () => 10,
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
          desc: () => `Reboot to bootloader mode, confirm on device`,
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

  const debugInfo = useMemo(() => {
    if (process.env.NODE_ENV !== 'production') {
      return (
        <Stack my="$6">
          <SizableText>
            {'debugInfo >>> '}
            {lastFirmwareTipMessage} ({firmwareProgress ?? '--'}%)
          </SizableText>

          {installProgressList.current.map((item, index) => (
            <SizableText key={index}>
              {index + 1}. {item}
            </SizableText>
          ))}
        </Stack>
      );
    }
  }, [firmwareProgress, lastFirmwareTipMessage]);

  // if (isDone) {
  //   return <Stack>{debugInfo}</Stack>;
  // }

  return (
    <Stack>
      {titleView}
      <Progress value={progress} />
      <SizableText>{desc}</SizableText>
      {debugInfo}
    </Stack>
  );
}
