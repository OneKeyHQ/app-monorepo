import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { isNumber } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Divider,
  Icon,
  Progress,
  SizableText,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';
import {
  EFirmwareUpdateSteps,
  EHardwareUiStateAction,
  useFirmwareUpdateRetryAtom,
  useFirmwareUpdateStepInfoAtom,
  useHardwareUiStateAtom,
  useHardwareUiStateCompletedAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';
import type {
  ICheckAllFirmwareReleaseResult,
  IDeviceFirmwareType,
} from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePrevious } from '../../../hooks/usePrevious';
import { FirmwareUpdatePromptBootloaderWebDevice } from '../components/FirmwareUpdatePromptBootloaderWebDevice';
import { FirmwareVersionProgressBar } from '../components/FirmwareVersionProgressBar';
import { useFirmwareVersionValid } from '../hooks/useFirmwareVersionValid';

interface IFirmwareUpdateVersionInfo {
  fromVersion: string;
  toVersion: string;
  hasUpgrade: boolean;
  title: string;
}

interface IFirmwareUpdateVersions {
  type: string;
  info: IFirmwareUpdateVersionInfo;
}

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

const calculateProgressInRange = ({
  startAt,
  maxAt,
  currentProgress,
}: {
  startAt: number;
  maxAt: number;
  currentProgress: number | null | undefined;
}) => {
  let newProgress =
    startAt + (currentProgress ?? 0) * ((maxAt - startAt) / 100);
  if (newProgress >= maxAt) {
    newProgress = maxAt;
  }
  return newProgress;
};

function FirmwareUpdateVersionItem({
  title,
  fromVersion,
  toVersion,
}: {
  title: string;
  fromVersion: string;
  toVersion: string;
}) {
  const { versionValid, unknownMessage } = useFirmwareVersionValid();
  return (
    <XStack alignItems="center" justifyContent="space-between">
      <SizableText size="$bodyMd" color="$textSubdued">
        {title}
      </SizableText>
      <XStack alignItems="center" gap="$2">
        <SizableText size="$bodyMd" color="$textSubdued">
          {versionValid(fromVersion) ? fromVersion : unknownMessage}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          →
        </SizableText>
        {/* <Icon name="→" size="$5" color="$textSubdued" /> */}
        <SizableText size="$bodyMd" color="$textSubdued">
          {versionValid(toVersion) ? toVersion : unknownMessage}
        </SizableText>
      </XStack>
    </XStack>
  );
}

export function FirmwareUpdateProgressBarView({
  versions,
  title,
  progress,
  desc,
}: {
  versions: IFirmwareUpdateVersions[];
  title: string;
  progress: number | null | undefined;
  desc: string;
}) {
  const intl = useIntl();

  return (
    <Stack pt="$9" pb="$3">
      <SizableText size="$heading2xl" mt="$3" mb="$5">
        {title}
      </SizableText>
      {/* Version View */}
      <Stack
        bg="$bgSubdued"
        borderRadius="$2"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        px="$4"
        py="$2"
        gap="$2"
      >
        {versions.map((version, index) => (
          <Fragment key={version.type}>
            <FirmwareUpdateVersionItem
              title={version.type}
              fromVersion={version.info.fromVersion}
              toVersion={version.info.toVersion}
            />
            {index < versions.length - 1 ? <Divider /> : null}
          </Fragment>
        ))}
      </Stack>
      <Stack mt="$12" mb="$3">
        <Progress size="medium" value={progress} />
      </Stack>
      <SizableText size="$bodyLg" color="$textSubdued">
        {desc}
      </SizableText>
    </Stack>
  );
}

export function FirmwareUpdateProgressBarV2({
  result,
  lastFirmwareTipMessage,
  isDone,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
  lastFirmwareTipMessage: EFirmwareUpdateTipMessages | undefined;
  isDone?: boolean;
}) {
  const intl = useIntl();
  const [stepInfo, setStepInfo] = useFirmwareUpdateStepInfoAtom();
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

  const firmwareProgress = state?.payload?.firmwareProgress;
  const firmwareProgressType = state?.payload?.firmwareProgressType;
  const firmwareTipMessage = state?.payload?.firmwareTipData?.message;

  const firmwareProgressRef = useRef(firmwareProgress);
  firmwareProgressRef.current = firmwareProgress;

  const updateProgress = useCallback(
    (type: IProgressType) => {
      const progressConfig: IProgressConfigItem[] = [
        {
          type: ['checking'],
          progress: () => 1,
          progressMax: () => checkingMaxProgress,
          desc: () =>
            intl.formatMessage({
              id: ETranslations.update_checking_device_if_no_restart,
            }),
        },
        {
          type: [EFirmwareUpdateTipMessages.StartDownloadFirmware],
          progress: () => 5,
          desc: () =>
            intl.formatMessage({
              id: ETranslations.update_downloading,
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
          type: [
            EFirmwareUpdateTipMessages.SelectDeviceInBootloaderForWebDevice,
          ],
          progress: () => 11,
          desc: () =>
            intl.formatMessage({
              id: ETranslations.firmware_update_grant_usb_instruction,
            }),
        },
        {
          type: [EFirmwareUpdateTipMessages.StartTransferData],
          progress: () =>
            calculateProgressInRange({
              startAt: 12,
              maxAt: 50,
              currentProgress: firmwareProgressRef.current,
            }),
          desc: () =>
            intl.formatMessage({
              id: ETranslations.update_transferring_data,
            }),
        },
        {
          type: ['installing'],
          progress: () =>
            calculateProgressInRange({
              startAt: 50,
              maxAt: 90,
              currentProgress: firmwareProgressRef.current,
            }),
          desc: () => {
            return intl.formatMessage({
              id: ETranslations.update_installing,
            });
          },
        },
        {
          type: [EFirmwareUpdateTipMessages.FirmwareUpdateCompleted],
          progress: () => 99,
          desc: () =>
            intl.formatMessage({
              id: ETranslations.firmware_update_status_validating,
            }),
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
    [intl],
  );

  const updateProgressRef = useRef(updateProgress);
  updateProgressRef.current = updateProgress;

  useEffect(() => {
    if (lastFirmwareTipMessage) {
      updateProgressRef.current(lastFirmwareTipMessage);
    }
  }, [lastFirmwareTipMessage]);

  useEffect(() => {
    if (isDone) {
      setTimeout(() => {
        updateProgressRef.current('done');
      }, 1000);
    }
  }, [isDone]);

  const installProgressList = useRef<string[]>([]);
  useEffect(() => {
    if (firmwareTipMessage) {
      installProgressList.current.push(firmwareTipMessage);
    }
  }, [firmwareTipMessage]);

  useEffect(() => {
    if (isNumber(firmwareProgress)) {
      updateProgressRef.current(
        firmwareProgressType === 'installingFirmware'
          ? 'installing'
          : EFirmwareUpdateTipMessages.StartTransferData,
      );
    }
  }, [firmwareProgress, firmwareProgressType]);

  useEffect(() => {
    console.log('FirmwareUpdateProgressBar: =>>>> result: ', result);
  }, [result]);

  const upgradeVersions = useMemo(() => {
    if (!result?.updateInfos) return [];

    const versions: IFirmwareUpdateVersions[] = [];

    if (result.updateInfos.firmware?.hasUpgrade) {
      versions.push({
        type: 'Firmware',
        info: {
          title: intl.formatMessage({ id: ETranslations.global_firmware }),
          fromVersion: result.updateInfos.firmware.fromVersion ?? '',
          toVersion: result.updateInfos.firmware.toVersion ?? '',
          hasUpgrade: true,
        },
      });
    }

    if (result.updateInfos.bootloader?.hasUpgrade) {
      versions.push({
        type: 'Bootloader',
        info: {
          title: intl.formatMessage({ id: ETranslations.global_bootloader }),
          fromVersion: result.updateInfos.bootloader.fromVersion ?? '',
          toVersion: result.updateInfos.bootloader.toVersion ?? '',
          hasUpgrade: true,
        },
      });
    }

    if (result.updateInfos.ble?.hasUpgrade) {
      versions.push({
        type: 'Bluetooth',
        info: {
          title: intl.formatMessage({ id: ETranslations.global_bluetooth }),
          fromVersion: result.updateInfos.ble.fromVersion ?? '',
          toVersion: result.updateInfos.ble.toVersion ?? '',
          hasUpgrade: true,
        },
      });
    }

    return versions;
  }, [result, intl]);

  const previousStepInfo = useRef(stepInfo);
  useEffect(() => {
    const fn = () => {
      previousStepInfo.current = stepInfo;
      setStepInfo({
        step: EFirmwareUpdateSteps.requestDeviceInBootloaderForWebDevice,
        payload: undefined,
      });
    };
    appEventBus.on(EAppEventBusNames.RequestDeviceInBootloaderForWebDevice, fn);
    return () => {
      appEventBus.off(
        EAppEventBusNames.RequestDeviceInBootloaderForWebDevice,
        fn,
      );
    };
  }, [setStepInfo, stepInfo]);

  const renderGrantUSBAccessButton = useCallback(() => {
    if (
      stepInfo?.step ===
      EFirmwareUpdateSteps.requestDeviceInBootloaderForWebDevice
    ) {
      return (
        <FirmwareUpdatePromptBootloaderWebDevice
          previousStepInfo={previousStepInfo.current}
        />
      );
    }
  }, [stepInfo?.step, previousStepInfo]);

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

  return (
    <Stack>
      <FirmwareUpdateProgressBarView
        versions={upgradeVersions}
        title="Installing firmware"
        progress={progress}
        desc={desc}
      />
      {debugInfo}
    </Stack>
  );
}
