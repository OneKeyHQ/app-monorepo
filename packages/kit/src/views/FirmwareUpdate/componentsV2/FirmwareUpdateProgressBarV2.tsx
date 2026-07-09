import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
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
  useFirmwareUpdateResultVerifyAtom,
  useFirmwareUpdateStepInfoAtom,
  useHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';
import type {
  ICheckAllFirmwareReleaseResult,
  IPro2FirmwareUpdateTarget,
} from '@onekeyhq/shared/types/device';

import { FirmwareUpdatePromptWebUsbDevice } from '../components/FirmwareUpdatePromptWebUsbDevice';
import { useFirmwareVersionValid } from '../hooks/useFirmwareVersionValid';

interface IFirmwareUpdateVersionInfo {
  fromVersion: string;
  toVersion: string;
  verifyVersion: string | undefined;
  hasUpgrade: boolean;
  title: string;
  githubReleaseUrl?: string;
}

interface IFirmwareUpdateVersions {
  type: string;
  info: IFirmwareUpdateVersionInfo;
}

type IProtocolV2FirmwareComponentDisplay = {
  target?: string;
  version?: number[];
  resourceManifest?: {
    packages?: Array<{
      name?: string;
      path?: string;
    }>;
  };
};

const PRO2_FORCE_TARGET_BY_COMPONENT_TARGET = new Map<
  string,
  IPro2FirmwareUpdateTarget
>([
  ['BOOTLOADER', 'boot'],
  ['APPLICATION_P1', 'app_v1'],
  ['APPLICATION_P2', 'app_v2'],
  ['CRATE', 'resource'],
  ['SE01', 'se01'],
  ['SE02', 'se02'],
  ['SE03', 'se03'],
  ['SE04', 'se04'],
]);

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
  verifyVersion,
  githubReleaseUrl,
  isDone,
  isVerified,
}: {
  title: string;
  fromVersion: string;
  toVersion: string;
  verifyVersion: string;
  githubReleaseUrl?: string;
  isDone?: boolean;
  isVerified?: boolean;
}) {
  const { versionValid, unknownMessage } = useFirmwareVersionValid();
  const renderToVersion = () => {
    if (!isDone && !isVerified) {
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

function formatVersion(version: string | number[] | undefined) {
  if (Array.isArray(version)) {
    return version.join('.');
  }
  return version ?? '';
}

function isPro2SafeOSFirmwareUpdate(
  result: ICheckAllFirmwareReleaseResult | undefined,
) {
  return (
    result?.deviceType === EDeviceType.Pro2 &&
    result?.updateInfos?.firmware?.hasUpgrade === true
  );
}

function FirmwareUpdateDebugPayloadSection({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const release = result?.updateInfos?.firmware?.releasePayload?.release;
  const components = release?.components as
    | Record<string, IProtocolV2FirmwareComponentDisplay>
    | undefined;
  const pro2ForceTargets = result?.pro2ForceTargets;
  const componentEntries = useMemo(() => {
    if (!components) return [];
    const forceTargets = new Set(pro2ForceTargets ?? []);
    const orderedKeys = [
      ...(release?.installOrder ?? []),
      ...Object.keys(components).filter(
        (key) => !release?.installOrder?.includes(key),
      ),
    ];
    return orderedKeys
      .map((key) => [key, components[key]] as const)
      .filter(([, component]) => {
        if (!component) return false;
        if (forceTargets.size === 0) return true;
        const target = component.target?.toUpperCase();
        const pro2ForceTarget = target
          ? PRO2_FORCE_TARGET_BY_COMPONENT_TARGET.get(target)
          : undefined;
        return Boolean(pro2ForceTarget && forceTargets.has(pro2ForceTarget));
      });
  }, [components, pro2ForceTargets, release?.installOrder]);

  if (componentEntries.length === 0) {
    return null;
  }

  return (
    <Stack
      bg="$bgSubdued"
      borderRadius="$2"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      px="$4"
      py="$3"
      mt="$3"
      gap="$2"
    >
      <SizableText size="$bodyMdMedium" color="$textSubdued">
        Debug update payload
      </SizableText>
      {componentEntries.map(([key, component]) => {
        const packageNames = component.resourceManifest?.packages
          ?.map((pkg) => pkg.name || pkg.path)
          .filter(Boolean)
          .join(', ');
        const version = formatVersion(component.version);
        return (
          <XStack key={key} gap="$2" alignItems="center" minWidth={0}>
            <SizableText size="$bodySm" color="$text" flex={1} minWidth={0}>
              {key}
            </SizableText>
            {packageNames ? (
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                flex={1}
                minWidth={0}
                numberOfLines={1}
              >
                {packageNames}
              </SizableText>
            ) : null}
            <SizableText size="$bodySm" color="$textSubdued" flexShrink={0}>
              {[component.target, version].filter(Boolean).join(' / ')}
            </SizableText>
          </XStack>
        );
      })}
    </Stack>
  );
}

export function FirmwareUpdateProgressBarView({
  versions,
  result,
  title,
  progress,
  desc,
  isDone,
  isVerified,
}: {
  versions: IFirmwareUpdateVersions[];
  result: ICheckAllFirmwareReleaseResult | undefined;
  title: string;
  progress: number | null | undefined;
  desc: string;
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
              />
              {index < versions.length - 1 ? <Divider /> : null}
            </Fragment>
          ))}
        </Stack>
        <FirmwareUpdateDebugPayloadSection result={result} />
        <Stack mt="$12" mb="$3">
          <Progress
            size="medium"
            value={progress}
            indicatorColor="$bgSuccessStrong"
          />
        </Stack>
        <SizableText size="$bodyLg" color="$textSubdued">
          {desc}
        </SizableText>
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
  const [progress, setProgress] = useState(1);
  const [isDoneInternal, setIsDoneInternal] = useState(!!isDone);

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
          type: [EFirmwareUpdateTipMessages.SwitchFirmwareReconnectDevice],
          progress: () => progressRef.current,
          progressMax: () => 99,
          desc: () =>
            intl.formatMessage({
              id: ETranslations.firmware_update_switch_firmware_reconnect_device,
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
              id: ETranslations.firmware_update_status_completed,
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
      });
    }
    setTimeout(() => {
      setIsDoneInternal(!!isDone);
    }, 1500);
  }, [isDone]);

  useEffect(() => {
    updateProgressRef.current('checking');
    setDesc(defaultDesc());
  }, [defaultDesc]);

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

    const versions: IFirmwareUpdateVersions[] = [];
    const isPro2SafeOSUpdate = isPro2SafeOSFirmwareUpdate(result);

    if (result.updateInfos.firmware?.hasUpgrade) {
      versions.push({
        type: isPro2SafeOSUpdate ? 'SafeOS' : 'Firmware',
        info: {
          title: isPro2SafeOSUpdate
            ? 'SafeOS'
            : intl.formatMessage({ id: ETranslations.global_firmware }),
          fromVersion: result.updateInfos.firmware.fromVersion ?? '',
          toVersion: result.updateInfos.firmware.toVersion ?? '',
          verifyVersion: resultVerifyVersions?.finalFirmwareVersion,
          hasUpgrade: true,
          githubReleaseUrl: result.updateInfos.firmware.githubReleaseUrl,
        },
      });
    }

    if (result.updateInfos.bootloader?.hasUpgrade && !isPro2SafeOSUpdate) {
      versions.push({
        type: 'Bootloader',
        info: {
          title: intl.formatMessage({ id: ETranslations.global_bootloader }),
          fromVersion: result.updateInfos.bootloader.fromVersion ?? '',
          toVersion: result.updateInfos.bootloader.toVersion ?? '',
          verifyVersion: resultVerifyVersions?.finalBootloaderVersion,
          hasUpgrade: true,
          githubReleaseUrl: result.updateInfos.bootloader.githubReleaseUrl,
        },
      });
    }

    if (result.updateInfos.ble?.hasUpgrade && !isPro2SafeOSUpdate) {
      versions.push({
        type: 'Bluetooth',
        info: {
          title: intl.formatMessage({ id: ETranslations.global_bluetooth }),
          fromVersion: result.updateInfos.ble.fromVersion ?? '',
          toVersion: result.updateInfos.ble.toVersion ?? '',
          verifyVersion: resultVerifyVersions?.finalBleVersion,
          hasUpgrade: true,
          githubReleaseUrl: result.updateInfos.ble.githubReleaseUrl,
        },
      });
    }

    return versions;
  }, [result, intl, resultVerifyVersions]);

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
    if (process.env.NODE_ENV !== 'production') {
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
  }, [firmwareProgress, lastFirmwareTipMessage, progress, showDebugInfo]);

  return (
    <Stack>
      <FirmwareUpdateProgressBarView
        versions={upgradeVersions}
        result={result}
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
        isDone={isDoneInternal}
        isVerified={isVerified}
      />
      {renderGrantUSBAccessButton()}
      {debugInfo}
    </Stack>
  );
}
