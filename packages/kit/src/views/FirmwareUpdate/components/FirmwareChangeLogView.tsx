import { useCallback, useState } from 'react';

import {
  Icon,
  IconButton,
  Markdown,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateStepInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IBleFirmwareUpdateInfo,
  IBootloaderUpdateInfo,
  IFirmwareUpdateInfo,
} from '@onekeyhq/shared/types/device';

import { FirmwareUpdatePageFooter } from './FirmwareUpdatePageLayout';
import { FirmwareUpdateWalletProfile } from './FirmwareUpdateWalletProfile';
import { FirmwareVersionProgressBar } from './FirmwareVersionProgressBar';

function ChangeLogSection({
  title,
  icon,
  initialCollapse = true,
  isDone,
  updateInfo,
}: {
  title: string;
  icon: IKeyOfIcons;
  initialCollapse?: boolean;
  isDone?: boolean;
  updateInfo:
    | IFirmwareUpdateInfo
    | IBleFirmwareUpdateInfo
    | IBootloaderUpdateInfo
    | undefined;
}) {
  const [collapse, setCollapse] = useState(initialCollapse);
  const onDropDownPressed = useCallback(() => {
    setCollapse(!collapse);
  }, [collapse]);
  return (
    <Stack>
      <XStack space="$3" py="$2" ai="center">
        <Icon name={icon} size="$5" />
        <Stack flex={1}>
          <SizableText size="$bodyLgMedium">{title}</SizableText>
          <SizableText size="$bodyMd" color="$textInfo">
            {isDone
              ? `Updated to the latest version ${updateInfo?.toVersion || ''}`
              : `${updateInfo?.toVersion || ''} is available`}
          </SizableText>
        </Stack>
        <IconButton
          icon={collapse ? 'ChevronDownSmallOutline' : 'ChevronTopSmallOutline'}
          variant="tertiary"
          onPress={onDropDownPressed}
        />
      </XStack>
      {collapse ? null : (
        <Stack bg="$bgStrong" p="$5" borderRadius="$3">
          <FirmwareVersionProgressBar
            fromVersion={updateInfo?.fromVersion || '?.?.?'}
            toVersion={updateInfo?.toVersion}
          />
          <Markdown>
            {
              // TODO type of IBootloaderUpdateInfo
              updateInfo?.changelog?.['en-US'] || 'No change log found.'
            }
          </Markdown>
        </Stack>
      )}
    </Stack>
  );
}

export function FirmwareChangeLogContentView({
  result,
  isDone,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
  isDone?: boolean;
}) {
  return (
    <Stack mt="$8">
      {result?.updateInfos?.bootloader?.hasUpgrade ? (
        <ChangeLogSection
          title="Bootloader"
          icon="StorageOutline"
          initialCollapse={isDone ?? false}
          updateInfo={result?.updateInfos?.bootloader}
          isDone={isDone}
        />
      ) : null}
      {result?.updateInfos?.ble?.hasUpgrade ? (
        <ChangeLogSection
          title="BlueTooth"
          icon="BluetoothOutline"
          updateInfo={result?.updateInfos?.ble}
          isDone={isDone}
        />
      ) : null}
      {result?.updateInfos?.firmware?.hasUpgrade ? (
        <ChangeLogSection
          title="Firmware"
          icon="LaunchOutline"
          updateInfo={result?.updateInfos?.firmware}
          isDone={isDone}
        />
      ) : null}
    </Stack>
  );
}

export function FirmwareChangeLogView({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const [, setStepInfo] = useFirmwareUpdateStepInfoAtom();

  return (
    <>
      <FirmwareUpdatePageFooter
        onConfirmText="Update Now"
        onConfirm={() =>
          setStepInfo({
            step: EFirmwareUpdateSteps.showCheckList,
            payload: undefined,
          })
        }
      />
      <Stack>
        <FirmwareUpdateWalletProfile result={result} />

        <FirmwareChangeLogContentView result={result} />
      </Stack>
    </>
  );
}
