import { Stack } from '@onekeyhq/components';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate';

import { useFirmwareUpdateActions } from '../hooks/useFirmwareUpdateActions';

import { FirmwareChangeLogContentView } from './FirmwareChangeLogView';
import { FirmwareUpdateBaseMessageView } from './FirmwareUpdateBaseMessageView';
import { FirmwareUpdatePageFooter } from './FirmwareUpdatePageLayout';

export function FirmwareUpdateDone({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const actions = useFirmwareUpdateActions();
  return (
    <Stack>
      <FirmwareUpdateBaseMessageView
        icon="CheckRadioSolid"
        tone="success"
        title="All updates complete 👏🏻"
      />
      <FirmwareChangeLogContentView result={result} isDone />
      <FirmwareUpdatePageFooter
        onConfirmText="Got it"
        onConfirm={() => {
          actions.closeUpdateModal();
        }}
      />
    </Stack>
  );
}
