import { Page } from '@onekeyhq/components';

import { FirmwareUpdatePro2DevSettings } from '../Tab/DevSettingsSection/FirmwareUpdateDevSettings';

export default function PageFirmwareUpdatePro2DevSettings() {
  return (
    <Page scrollEnabled>
      <Page.Header title="Pro2 Firmware Dev Settings" />
      <FirmwareUpdatePro2DevSettings />
    </Page>
  );
}
