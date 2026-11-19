import { useIntl } from 'react-intl';

import { SizableText, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// Desktop page title. Phones show it in the navigation bar instead, and adding
// a device is the last card in the grid on both.
function SectionHeader() {
  const intl = useIntl();
  const { gtMd } = useMedia();
  if (!gtMd) {
    return null;
  }
  return (
    <SizableText size="$heading2xl" color="$text">
      {intl.formatMessage({
        id: ETranslations.device_management_devices__title,
      })}
    </SizableText>
  );
}

export default SectionHeader;
