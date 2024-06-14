import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function FirmwareLatestVersionInstalled() {
  const intl = useIntl();
  return (
    <Stack ai="center" jc="center" h={500}>
      <Icon size="$14" name="CheckRadioSolid" color="$iconSuccess" />
      <SizableText my="$6" size="$headingLg">
        {intl.formatMessage({ id: ETranslations.update_latest_version })}
      </SizableText>
    </Stack>
  );
}
