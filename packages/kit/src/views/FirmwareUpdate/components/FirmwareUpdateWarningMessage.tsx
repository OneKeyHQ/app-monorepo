import { useIntl } from 'react-intl';

import { SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function FirmwareUpdateWarningMessage() {
  const intl = useIntl();
  return (
    <Stack backgroundColor="$bgCautionSubdued" m="$-5" py="$3" px="$5" mb="$6">
      <SizableText>
        {intl.formatMessage({
          id: platformEnv.isNative
            ? ETranslations.update_keep_bluetooth_connected_and_app_active
            : ETranslations.update_keep_usb_connected_and_app_active,
        })}
      </SizableText>
    </Stack>
  );
}
