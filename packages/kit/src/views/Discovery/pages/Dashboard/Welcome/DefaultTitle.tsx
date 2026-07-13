// Let's Dive in
import { memo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components/src/primitives';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';

const DefaultTitleComponent = () => {
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

export const DefaultTitle = memo(DefaultTitleComponent);
