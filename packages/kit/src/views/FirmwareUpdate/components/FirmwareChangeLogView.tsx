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

import { FirmwareUpdatePageFooter } from './FirmwareUpdatePageLayout';
import { FirmwareUpdateWalletProfile } from './FirmwareUpdateWalletProfile';

function ChangeLogSection({
  title,
  isDone,
  updateInfo,
}: {
  title: string;
  isDone?: boolean;
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
        {isDone
          ? `Updated to the latest version ${updateInfo?.toVersion || ''}`
          : `${updateInfo?.toVersion || ''} is available`}
      </SizableText>
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

export function FirmwareChangeLogContentView({
  result,
  isDone,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
  isDone?: boolean;
}) {
  return (
    <Stack>
      {result?.updateInfos?.firmware?.hasUpgrade ? (
        <ChangeLogSection
          title="Firmware"
          updateInfo={result?.updateInfos?.firmware}
          isDone={isDone}
        />
      ) : null}

      {result?.updateInfos?.ble?.hasUpgrade ? (
        <ChangeLogSection
          title="BlueTooth"
          updateInfo={result?.updateInfos?.ble}
          isDone={isDone}
        />
      ) : null}

      {result?.updateInfos?.bootloader?.hasUpgrade ? (
        <ChangeLogSection
          title="Bootloader"
          updateInfo={result?.updateInfos?.bootloader}
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
