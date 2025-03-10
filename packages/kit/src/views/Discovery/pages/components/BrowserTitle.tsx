import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function BrowserTitle() {
  const intl = useIntl();
  const media = useMedia();

  const memoizedText = useMemo(
    () =>
      intl.formatMessage({
        id: media.gtSm
          ? ETranslations.global_browser
          : ETranslations.global_browser,
      }),
    [intl, media.gtSm],
  );

  return (
    <SizableText size="$headingLg" color="$text">
      {memoizedText}
    </SizableText>
  );
}
