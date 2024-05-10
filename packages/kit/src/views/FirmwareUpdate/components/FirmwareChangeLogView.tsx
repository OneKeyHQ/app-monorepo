import { Markdown, SizableText, Stack } from '@onekeyhq/components';
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

import { useExtensionUpdatingFromExpandTab } from '../hooks/useFirmwareUpdateHooks';

import { FirmwareUpdatePageFooter } from './FirmwareUpdatePageLayout';
import { FirmwareUpdateWalletProfile } from './FirmwareUpdateWalletProfile';

function ChangeLogSection({
  title,
  updateInfo,
}: {
  title: string;
  updateInfo:
    | IFirmwareUpdateInfo
    | IBleFirmwareUpdateInfo
    | IBootloaderUpdateInfo
    | undefined;
}) {
  return (
    <Stack mt="$6">
      <SizableText size="$heading3xl">{title}</SizableText>
      <SizableText>
        {updateInfo?.fromVersion || '?.?.?'}-{updateInfo?.toVersion}
      </SizableText>
      <Markdown>
        {
          // TODO type of IBootloaderUpdateInfo
          updateInfo?.changelog?.['en-US'] || 'No change log found.'
        }
      </Markdown>
    </Stack>
  );
}

export function FirmwareChangeLogView({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const [, setStepInfo] = useFirmwareUpdateStepInfoAtom();

  // TODO move to pageBase, ignore it at Bootloader guide
  useExtensionUpdatingFromExpandTab();

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

        {result?.updateInfos?.firmware?.hasUpgrade ? (
          <ChangeLogSection
            title="New Firmware Version 🎉"
            updateInfo={result?.updateInfos?.firmware}
          />
        ) : null}

        {result?.updateInfos?.ble?.hasUpgrade ? (
          <ChangeLogSection
            title="New BlueTooth Version 🎉"
            updateInfo={result?.updateInfos?.ble}
          />
        ) : null}

        {result?.updateInfos?.bootloader?.hasUpgrade ? (
          <ChangeLogSection
            title="New Bootloader Version 🎉"
            updateInfo={result?.updateInfos?.bootloader}
          />
        ) : null}
      </Stack>
    </>
  );
}
