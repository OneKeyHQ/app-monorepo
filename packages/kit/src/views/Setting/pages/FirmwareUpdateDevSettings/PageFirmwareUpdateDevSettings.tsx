import { Page } from '@onekeyhq/components';

import { FirmwareUpdateDevSettings } from '../List/DevSettingsSection/FirmwareUpdateDevSettings';

export default function PageFirmwareUpdateDevSettings() {
  return (
    <Page>
      <Page.Header title="FirmwareUpdateDevSettings" />
      <FirmwareUpdateDevSettings />
    </Page>
  );
}
