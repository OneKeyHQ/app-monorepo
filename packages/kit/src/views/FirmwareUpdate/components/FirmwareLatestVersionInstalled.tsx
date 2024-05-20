import { Stack } from '@onekeyhq/components';

import { FirmwareUpdateBaseMessageView } from './FirmwareUpdateBaseMessageView';

export function FirmwareLatestVersionInstalled() {
  return (
    <Stack>
      <FirmwareUpdateBaseMessageView
        icon="CheckLargeOutline"
        tone="success"
        title="You are on the latest version"
        message="No further updates are required at this time."
      />
    </Stack>
  );
}
