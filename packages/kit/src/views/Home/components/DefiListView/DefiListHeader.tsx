import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function DefiListHeader() {
  const intl = useIntl();
  return (
    <XStack px="$2">
      <SizableText size="$headingLg">
        {intl.formatMessage({ id: ETranslations.global_asset })}
      </SizableText>
    </XStack>
  );
}

export { DefiListHeader };
