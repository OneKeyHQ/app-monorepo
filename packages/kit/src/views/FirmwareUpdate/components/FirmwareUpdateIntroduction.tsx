import { useIntl } from 'react-intl';

import { SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function FirmwareUpdateIntroduction() {
  const intl = useIntl();
  return (
    <Stack pt={10} px="$5" pb="$5">
      <SizableText
        size="$bodyLg"
        $gtMd={{
          size: '$bodyMd',
        }}
      >
        {intl.formatMessage({
          id: ETranslations.firmware_update_changelog_introduction,
        })}
      </SizableText>
    </Stack>
  );
}
