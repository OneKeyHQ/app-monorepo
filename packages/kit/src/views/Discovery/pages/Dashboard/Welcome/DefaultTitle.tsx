// Let's Dive in
import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components/src/primitives';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';

export const DefaultTitle = () => {
  const intl = useIntl();

  return (
    <SizableText
      color="$text"
      size="$heading2xl"
      fontWeight="bold"
      textAlign="center"
    >
      {intl.formatMessage({ id: ETranslations.browser_dive_in })}
    </SizableText>
  );
};
