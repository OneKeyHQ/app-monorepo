import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function BrowserTitle() {
  const intl = useIntl();

  return (
    <SizableText size="$headingLg" color="$text">
      {intl.formatMessage({
        id: ETranslations.global_browser,
      })}
    </SizableText>
  );
}
