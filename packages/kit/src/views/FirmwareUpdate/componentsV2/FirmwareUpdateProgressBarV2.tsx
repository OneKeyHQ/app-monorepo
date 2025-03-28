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
import type {
  EFirmwareUpdateTipMessages,
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
}: {
  versions: IFirmwareUpdateVersions[];
}) {
  const intl = useIntl();

  return (
    <Stack pt="$9" pb="$3">
      <SizableText size="$heading2xl" mt="$3" mb="$5">
        Installing firmware
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
        <Progress size="medium" value={10} />
      </Stack>
      <SizableText size="$bodyLg" color="$textSubdued">
        Downloading...
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

  return (
    <Stack>
      <FirmwareUpdateProgressBarView versions={upgradeVersions} />
    </Stack>
  );
}
