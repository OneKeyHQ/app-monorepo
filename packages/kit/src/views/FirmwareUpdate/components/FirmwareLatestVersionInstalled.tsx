import { Icon, Stack } from '@onekeyhq/components';

import { FirmwareUpdateBaseMessageView } from './FirmwareUpdateBaseMessageView';

export function FirmwareLatestVersionInstalled() {
  return (
    <Stack>
      <FirmwareUpdateBaseMessageView
        icon={<Icon name="CheckLargeOutline" size={56} />}
        title="You are on the latest version"
        message="No further updates are required at this time."
      />
    </Stack>
  );
}
