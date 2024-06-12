import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { FirmwareUpdateBaseMessageView } from './FirmwareUpdateBaseMessageView';

export function FirmwareLatestVersionInstalled() {
  const intl = useIntl();
  return (
    <Stack>
      <FirmwareUpdateBaseMessageView
        icon="CheckLargeOutline"
        tone="success"
        title={intl.formatMessage({ id: ETranslations.update_latest_version })}
        message="No further updates are required at this time."
      />
    </Stack>
  );
}
