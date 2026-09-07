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
  Anchor,
  Button,
  Divider,
  Icon,
  Progress,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import {
  EFirmwareUpdateSteps,
  useDevSettingsPersistAtom,
  useFirmwareUpdateDevSettingsPersistAtom,
  useFirmwareUpdateResultVerifyAtom,
  useFirmwareUpdateStepInfoAtom,
  useHardwareUiStateAtom,
  useHardwareUiStateCompletedAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';
import { EHardwareUiStateAction } from '@onekeyhq/shared/types/hardwareUi';

import { FirmwareUpdatePromptWebUsbDevice } from '../components/FirmwareUpdatePromptWebUsbDevice';
import { useFirmwareVersionValid } from '../hooks/useFirmwareVersionValid';
import {
  getProtocolV2FirmwareVersionDisplayItems,
  getProtocolV2FirmwareVersionTitle,
  isPro2SafeOSFirmwareUpdate,
} from '../utils';

import {
  calculateProgressInRange,
  getFirmwareTransferDisplayMetrics,
  normalizeFirmwareUpdateProgressType,
  resolveFirmwareInstallProgress,
} from './firmwareUpdateProgressUtils';

interface IFirmwareUpdateVersionInfo {
  fromVersion: string;
  toVersion: string;
  verifyVersion: string | undefined;
  hasUpgrade: boolean;
  title: string;
  githubReleaseUrl?: string;
  releaseIdentifierOnly?: boolean;
  currentVersionOnly?: boolean;
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
  //   title: (type: IProgressType) => string;
  desc: () => string;
};

function FirmwareUpdateVersionItem({
  title,
  fromVersion,
  toVersion,
  verifyVersion,
  githubReleaseUrl,
  isDone,
  isVerified,
  releaseIdentifierOnly,
  currentVersionOnly,
}: {
  title: string;
  fromVersion: string;
  toVersion: string;
  verifyVersion: string;
  githubReleaseUrl?: string;
  isDone?: boolean;
  isVerified?: boolean;
  releaseIdentifierOnly?: boolean;
  currentVersionOnly?: boolean;
}) {
  const { versionValid, unknownMessage } = useFirmwareVersionValid();
  if (releaseIdentifierOnly) {
    return (
      <XStack
        alignItems="center"
        justifyContent="space-between"
        gap="$2"
        minWidth={0}
      >
        <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
          {title}
        </SizableText>
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          minWidth={0}
          flexShrink={1}
          numberOfLines={1}
        >
          {toVersion}
        </SizableText>
      </XStack>
    );
  }
  if (currentVersionOnly) {
    return (
      <XStack
        alignItems="center"
        justifyContent="space-between"
        gap="$2"
        minWidth={0}
      >
        <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
          {title}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {versionValid(fromVersion) ? fromVersion : unknownMessage}
        </SizableText>
      </XStack>
    );
  }
  const renderToVersion = () => {
    if ((!isDone && !isVerified) || !verifyVersion) {
      return (
        <SizableText size="$bodyMd" color="$textSubdued">
          {versionValid(toVersion) ? toVersion : unknownMessage}
        </SizableText>
      );
    }

    const isVerifiedVersion = verifyVersion === toVersion;
    const textColor = isVerifiedVersion ? '$textSuccess' : '$textCritical';
    const displayVersion = verifyVersion || toVersion;

    if (githubReleaseUrl) {
      return (
        <Anchor
          href={githubReleaseUrl}
          color={textColor}
          size="$bodyMd"
          target="_blank"
          textDecorationLine="underline"
          onPress={(e) => {
            e.stopPropagation();
          }}
        >
          {versionValid(displayVersion) ? displayVersion : unknownMessage}
        </Anchor>
      );
    }

    return (
      <SizableText size="$bodyMd" color={textColor}>
        {versionValid(displayVersion) ? displayVersion : unknownMessage}
      </SizableText>
    );
  };

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
        {renderToVersion()}
      </XStack>
    </XStack>
  );
}

export function FirmwareUpdateProgressBarView({
  versions,
  title,
  progress,
  desc,
  estimatedTimeText,
  isDone,
  isVerified,
}: {
  versions: IFirmwareUpdateVersions[];
  title: string;
  progress: number | null | undefined;
  desc: string;
  estimatedTimeText?: string;
  isDone?: boolean;
  isVerified?: boolean;
}) {
  return (
    <>
      {isDone ? (
        <Stack pt="$6">
          <Icon name="CheckRadioSolid" color="$iconSuccess" size="$12" />
        </Stack>
      ) : null}
      <Stack pt={isDone ? '$3' : '$9'} pb="$3">
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
                isDone={isDone}
                isVerified={isVerified}
                title={version.type}
                fromVersion={version.info.fromVersion}
                toVersion={version.info.toVersion}
                verifyVersion={version.info.verifyVersion ?? ''}
                githubReleaseUrl={version.info.githubReleaseUrl}
                releaseIdentifierOnly={version.info.releaseIdentifierOnly}
                currentVersionOnly={version.info.currentVersionOnly}
              />
              {index < versions.length - 1 ? <Divider /> : null}
            </Fragment>
          ))}
        </Stack>
        <Stack mt="$12" mb="$3">
          <Progress
            size="medium"
            value={progress}
            indicatorColor="$bgSuccessStrong"
          />
        </Stack>
        <XStack alignItems="center" justifyContent="space-between" gap="$2">
          <SizableText
            size="$bodyLg"
            color="$textSubdued"
            minWidth={0}
            flexShrink={1}
          >
            {desc}
          </SizableText>
          {estimatedTimeText ? (
            <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
              {estimatedTimeText}
            </SizableText>
          ) : null}
        </XStack>
      </Stack>
    </>
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
  const [completedState] = useHardwareUiStateCompletedAtom();
  const [devSettings] = useDevSettingsPersistAtom();
  const [firmwareDevSettings] = useFirmwareUpdateDevSettingsPersistAtom();
  const hideDebugInfo =
    devSettings.enabled &&
    result?.deviceType === 'pro2' &&
    firmwareDevSettings.hidePro2FirmwareDebugInfo === true;
  const [progress, setProgress] = useState(1);
  const [isDoneInternal, setIsDoneInternal] = useState(!!isDone);

  const progressRef = useRef(progress);
  progressRef.current = progress;

  const defaultDesc = useCallback(
    () => intl.formatMessage({ id: ETranslations.global_checking_device }),
    [intl],
  );
  const [desc, setDesc] = useState(defaultDesc());

  // The active state may be cleared when the confirmation dialog closes.
  // Use the latest completed event so the firmware page can still consume it.
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
  const firmwareTipMessage = state?.payload?.firmwareTipData?.message;

  const estimatedTimeText = useMemo<string | undefined>(() => {
    if (firmwareProgressType !== 'transferData') {
      return undefined;
    }
    const displayMetrics = getFirmwareTransferDisplayMetrics(
      firmwareTransferMetrics,
    );
    if (!displayMetrics) {
      return undefined;
    }
    return intl.formatMessage(
      { id: ETranslations.firmware_update_estimated_time__desc },
      { time: displayMetrics.estimatedRemainingText ?? '- s' },
    );
  }, [firmwareProgressType, firmwareTransferMetrics, intl]);

  const firmwareProgressRef = useRef(firmwareProgress);
  firmwareProgressRef.current = firmwareProgress;
  const firmwareInstallPhaseProgressRef = useRef(firmwareInstallPhaseProgress);
  firmwareInstallPhaseProgressRef.current = firmwareInstallPhaseProgress;

  const updateProgress = useCallback(
    (type: IProgressType) => {
      const normalizedType = normalizeFirmwareUpdateProgressType(type);
      const progressConfig: IProgressConfigItem[] = [
        {
          type: ['checking'],
          progress: () => 1,
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
          type: [EFirmwareUpdateTipMessages.SwitchFirmwareReconnectDevice],
          progress: () => progressRef.current,
          desc: () =>
            intl.formatMessage({
              id: isPro2SafeOSFirmwareUpdate(result)
                ? ETranslations.update_keep_usb_connected_and_app_active
                : ETranslations.firmware_update_switch_firmware_reconnect_device,
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
          type: [EFirmwareUpdateTipMessages.ConfirmOnDevice],
          progress: () => progressRef.current,
          desc: () =>
            intl.formatMessage({
              id: ETranslations.global_confirm_on_device,
            }),
        },
        {
          type: [EFirmwareUpdateTipMessages.FirmwareUpdating, 'installing'],
          progress: () =>
            calculateProgressInRange({
              startAt: 50,
              maxAt: 90,
              currentProgress: resolveFirmwareInstallProgress({
                installPhaseProgress: firmwareInstallPhaseProgressRef.current,
                firmwareProgress: firmwareProgressRef.current,
              }),
            }),
          desc: () => {
            return intl.formatMessage({
              id:
                firmwareInstallPhase === 'verify'
                  ? ETranslations.firmware_update_status_validating
                  : ETranslations.update_installing,
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
              id: ETranslations.firmware_update_status_completed,
            }),
        },
      ];

      const index = progressConfig.findIndex((c) =>
        c.type.includes(normalizedType),
      );
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
            type: normalizedType,
          });
          progressRef.current = newProgress;
          return newProgress;
        });

        setDesc(item.desc());
      }
    },
    [firmwareInstallPhase, intl, result],
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
      });
    }
    setTimeout(() => {
      setIsDoneInternal(!!isDone);
    }, 1500);
  }, [isDone]);

  useEffect(() => {
    if (stepInfo.step === EFirmwareUpdateSteps.installing) {
      if (!lastFirmwareTipMessage && !isNumber(firmwareProgress)) {
        updateProgressRef.current(EFirmwareUpdateTipMessages.StartTransferData);
      }
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
    setDesc(defaultDesc());
  }, [defaultDesc, firmwareProgress, lastFirmwareTipMessage, stepInfo]);

  const installProgressList = useRef<string[]>([]);
  useEffect(() => {
    if (firmwareTipMessage) {
      installProgressList.current.push(firmwareTipMessage);
    }
  }, [firmwareTipMessage]);

  useEffect(() => {
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
  ]);

  useEffect(() => {
    console.log('FirmwareUpdateProgressBar: =>>>> result: ', result);
  }, [result]);

  const [resultVerifyVersions] = useFirmwareUpdateResultVerifyAtom();
  const [isVerified, setIsVerified] = useState(false);
  useEffect(() => {
    setTimeout(() => {
      setIsVerified(
        resultVerifyVersions
          ? Object.keys(resultVerifyVersions).length > 0
          : false,
      );
    }, 1500);
  }, [resultVerifyVersions]);

  const upgradeVersions = useMemo(() => {
    if (!result?.updateInfos) return [];

    const protocolV2VersionItems = getProtocolV2FirmwareVersionDisplayItems(
      result,
      {
        includeComponents: devSettings.enabled && !hideDebugInfo,
      },
    );
    if (protocolV2VersionItems.length > 0) {
      return protocolV2VersionItems.map((item) => {
        let verifyVersion: string | undefined;
        if (item.target === 'safeos') {
          verifyVersion = resultVerifyVersions?.finalFirmwareVersion;
        } else if (item.target === 'boot') {
          verifyVersion = resultVerifyVersions?.finalBootloaderVersion;
        } else if (item.target === 'coprocessor') {
          verifyVersion = resultVerifyVersions?.finalBleVersion;
        }
        const title = getProtocolV2FirmwareVersionTitle({
          target: item.target,
          intl,
        });
        return {
          type: item.target,
          info: {
            title,
            fromVersion: item.currentVersion ?? '',
            toVersion: item.targetVersion ?? '',
            verifyVersion,
            hasUpgrade: Boolean(item.targetVersion),
            releaseIdentifierOnly: item.releaseIdentifierOnly,
            currentVersionOnly: item.target === 'safeos' && !item.targetVersion,
          },
        };
      });
    }

    const versions: IFirmwareUpdateVersions[] = [];
    const firmwareInfo = result.updateInfos.firmware;
    const bootloaderInfo = result.updateInfos.bootloader;
    const bleInfo = result.updateInfos.ble;

    if (firmwareInfo?.hasUpgrade) {
      versions.push({
        type: 'Firmware',
        info: {
          title: intl.formatMessage({ id: ETranslations.global_firmware }),
          fromVersion: firmwareInfo?.fromVersion ?? '',
          toVersion: firmwareInfo?.toVersion ?? '',
          verifyVersion: resultVerifyVersions?.finalFirmwareVersion,
          hasUpgrade: true,
          githubReleaseUrl: firmwareInfo?.githubReleaseUrl,
        },
      });
    }

    if (bootloaderInfo?.hasUpgrade) {
      versions.push({
        type: 'Bootloader',
        info: {
          title: intl.formatMessage({ id: ETranslations.global_bootloader }),
          fromVersion: bootloaderInfo?.fromVersion ?? '',
          toVersion: bootloaderInfo?.toVersion ?? '',
          verifyVersion: resultVerifyVersions?.finalBootloaderVersion,
          hasUpgrade: true,
          githubReleaseUrl: bootloaderInfo?.githubReleaseUrl,
        },
      });
    }

    if (bleInfo?.hasUpgrade) {
      versions.push({
        type: 'Bluetooth',
        info: {
          title: intl.formatMessage({ id: ETranslations.global_bluetooth }),
          fromVersion: bleInfo?.fromVersion ?? '',
          toVersion: bleInfo?.toVersion ?? '',
          verifyVersion: resultVerifyVersions?.finalBleVersion,
          hasUpgrade: true,
          githubReleaseUrl: bleInfo?.githubReleaseUrl,
        },
      });
    }

    return versions;
  }, [devSettings.enabled, hideDebugInfo, result, intl, resultVerifyVersions]);

  const previousStepInfo = useRef(stepInfo);
  useEffect(() => {
    const onBootloaderRequest = () => {
      previousStepInfo.current = stepInfo;
      setStepInfo({
        step: EFirmwareUpdateSteps.requestDeviceInBootloaderForWebDevice,
        payload: undefined,
      });
    };
    const onSwitchFirmwareRequest = () => {
      previousStepInfo.current = stepInfo;
      setStepInfo({
        step: EFirmwareUpdateSteps.requestDeviceForSwitchFirmwareWebDevice,
        payload: undefined,
      });
    };
    appEventBus.on(
      EAppEventBusNames.RequestDeviceInBootloaderForWebDevice,
      onBootloaderRequest,
    );
    appEventBus.on(
      EAppEventBusNames.RequestDeviceForSwitchFirmwareWebDevice,
      onSwitchFirmwareRequest,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.RequestDeviceInBootloaderForWebDevice,
        onBootloaderRequest,
      );
      appEventBus.off(
        EAppEventBusNames.RequestDeviceForSwitchFirmwareWebDevice,
        onSwitchFirmwareRequest,
      );
    };
  }, [setStepInfo, stepInfo]);

  const renderGrantUSBAccessButton = useCallback(() => {
    if (
      stepInfo?.step ===
      EFirmwareUpdateSteps.requestDeviceInBootloaderForWebDevice
    ) {
      return (
        <FirmwareUpdatePromptWebUsbDevice
          previousStepInfo={previousStepInfo.current}
          requestType="bootloader"
        />
      );
    }
    if (
      stepInfo?.step ===
      EFirmwareUpdateSteps.requestDeviceForSwitchFirmwareWebDevice
    ) {
      return (
        <FirmwareUpdatePromptWebUsbDevice
          previousStepInfo={previousStepInfo.current}
          requestType="switchFirmware"
        />
      );
    }
  }, [stepInfo?.step, previousStepInfo]);

  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const debugInfo = useMemo(() => {
    if (process.env.NODE_ENV !== 'production' && !hideDebugInfo) {
      return (
        <Stack my="$6">
          <Button
            testID="firmware-update-debug-info-btn"
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
  }, [
    firmwareProgress,
    hideDebugInfo,
    lastFirmwareTipMessage,
    progress,
    showDebugInfo,
  ]);

  return (
    <Stack>
      <FirmwareUpdateProgressBarView
        versions={upgradeVersions}
        title={
          isDoneInternal
            ? intl.formatMessage({
                id: ETranslations.update_all_updates_complete,
              })
            : intl.formatMessage({
                id: ETranslations.global_installing_firmware,
              })
        }
        progress={progress}
        desc={desc}
        estimatedTimeText={estimatedTimeText}
        isDone={isDoneInternal}
        isVerified={isVerified}
      />
      {renderGrantUSBAccessButton()}
      {debugInfo}
    </Stack>
  );
}
