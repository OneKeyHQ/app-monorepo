import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isNumber } from 'lodash';
import { useIntl } from 'react-intl';

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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { IDeviceFirmwareType } from '@onekeyhq/shared/types/device';
import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePrevious } from '../../../hooks/usePrevious';

import { FirmwareVersionProgressBar } from './FirmwareVersionProgressBar';

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

const checkingMaxProgress = 10;

export function FirmwareUpdateProgressBarView({
  totalStep,
  currentStep,
  title,
  fromVersion: versionFrom,
  toVersion: versionTo,
  progress,
  desc,
}: {
  totalStep: number | undefined;
  currentStep: number | undefined;
  title: string;
  fromVersion: string | undefined;
  toVersion: string | undefined;
  progress: number | null | undefined;
  desc: string;
}) {
  const intl = useIntl();
  const phaseStepView = useMemo(() => {
    if (!totalStep || !currentStep) {
      return <Skeleton width={120} height={16} />;
    }
    if (totalStep <= 1) {
      return null;
    }
    return (
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage(
          { id: ETranslations.global_step_str },
          {
            step: `${currentStep}/${totalStep}`,
          },
        )}
      </SizableText>
    );
  }, [intl, currentStep, totalStep]);

  const versionView = useMemo(() => {
    if (!versionTo) {
      return <Skeleton width={80} height={16} />;
    }
    return (
      <FirmwareVersionProgressBar
        fromVersion={versionFrom}
        toVersion={versionTo}
      />
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
        <Progress size="medium" value={progress} />
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
  const intl = useIntl();
  const [stepInfo] = useFirmwareUpdateStepInfoAtom();
  const [state] = useHardwareUiStateAtom();
  const [stateFull] = useHardwareUiStateCompletedAtom();
  const [progress, setProgress] = useState(1);
  const [retryInfo] = useFirmwareUpdateRetryAtom();

  const progressRef = useRef(progress);
  progressRef.current = progress;

  const progressMaxRef = useRef(checkingMaxProgress);

  const defaultDesc = useCallback(
    () => intl.formatMessage({ id: ETranslations.global_checking_device }),
    [intl],
  );
  const [desc, setDesc] = useState(defaultDesc());

  const firmwareType: IDeviceFirmwareType | undefined = useMemo(() => {
    if (stepInfo?.step === EFirmwareUpdateSteps.installing) {
      return (
        stepInfo.payload.installingTarget?.updateInfo?.firmwareType || undefined
      );
    }
  }, [stepInfo.payload, stepInfo?.step]);

  const { totalStep, currentStep } = useMemo(() => {
    if (stepInfo?.step === EFirmwareUpdateSteps.installing) {
      const installingTarget = stepInfo?.payload?.installingTarget;
      if (installingTarget) {
        return {
          totalStep: installingTarget.totalPhase.length,
          currentStep:
            installingTarget.totalPhase.findIndex(
              (item) => item === installingTarget.currentPhase,
            ) + 1,
        };
      }
    }
    return { totalPhase: null, currentPhase: null };
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  const titleText = useMemo(() => {
    let text = intl.formatMessage({ id: ETranslations.global_preparing });
    if (lastFirmwareTipMessage) {
      text = intl.formatMessage({ id: ETranslations.global_updating });
    }
    if (firmwareType) {
      // type IDeviceFirmwareType = 'firmware' | 'ble' | 'bootloader';
      text = intl.formatMessage(
        {
          id: ETranslations.global_updating_type,
        },
        {
          type: firmwareType,
        },
      );
      if (firmwareType === 'ble') {
        text = intl.formatMessage(
          {
            id: ETranslations.global_updating_type,
          },
          {
            type: intl.formatMessage({ id: ETranslations.global_bluetooth }),
          },
        );
      }
    }
    if (isDone) {
      text = intl.formatMessage({ id: ETranslations.global_done });
    }
    return text;
  }, [intl, firmwareType, isDone, lastFirmwareTipMessage]);

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
          desc: () =>
            intl.formatMessage({
              id: ETranslations.update_checking_latest_ui_resources,
            }),
        },
        {
          type: [EFirmwareUpdateTipMessages.DownloadLatestUiResource],
          progress: () => 3,
          desc: () =>
            intl.formatMessage({
              id: ETranslations.update_downloading_latest_ui_resources,
            }),
        },
        {
          type: [EFirmwareUpdateTipMessages.DownloadLatestUiResourceSuccess],
          progress: () => 5,
          desc: () =>
            intl.formatMessage({
              id: ETranslations.update_download_success,
            }),
        },
        {
          type: [EFirmwareUpdateTipMessages.UpdateSysResource],
          progress: () => 7,
          desc: () =>
            intl.formatMessage({
              id: ETranslations.update_updating_ui_resources,
            }),
        },
        {
          type: [EFirmwareUpdateTipMessages.UpdateSysResourceSuccess],
          progress: () => 9,
          desc: () =>
            intl.formatMessage({
              id: ETranslations.update_update_ui_resources_success,
            }),
        },
        {
          type: [EFirmwareUpdateTipMessages.AutoRebootToBootloader],
          progress: () => 10,
          desc: () =>
            intl.formatMessage({
              id: ETranslations.update_reboot_to_bootloader_mode,
            }),
        },
        {
          type: [EFirmwareUpdateTipMessages.GoToBootloaderSuccess],
          progress: () => 12,
          desc: () =>
            intl.formatMessage({ id: ETranslations.update_reboot_success }),
        },
        {
          type: [
            EFirmwareUpdateTipMessages.DownloadFirmware,
            EFirmwareUpdateTipMessages.DownloadLatestBootloaderResource,
          ],
          progress: () => 14,
          desc: () =>
            intl.formatMessage({ id: ETranslations.update_downloading }),
        },
        {
          type: [
            EFirmwareUpdateTipMessages.DownloadFirmwareSuccess,
            EFirmwareUpdateTipMessages.DownloadLatestBootloaderResourceSuccess,
          ],
          progress: () => 20,
          desc: () =>
            intl.formatMessage({ id: ETranslations.update_download_success }),
        },
        {
          type: [EFirmwareUpdateTipMessages.FirmwareEraseSuccess],
          progress: () => 25,
          desc: () =>
            intl.formatMessage({ id: ETranslations.update_transferring_data }),
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
              return intl.formatMessage({
                id: ETranslations.update_installing,
              });
            }
            return intl.formatMessage({
              id: ETranslations.update_transferring_data,
            });
          },
        },
        {
          type: ['done'],
          progress: () => 100,
          desc: () =>
            intl.formatMessage({
              id: ETranslations.update_update_completed,
            }),
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
      intl,
      defaultDesc,
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
  }, [defaultDesc, firmwareType, stepInfo?.step]);

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
        totalStep={totalStep}
        currentStep={currentStep}
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
