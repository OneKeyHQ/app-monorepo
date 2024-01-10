import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';

function DefiListHeader() {
  const intl = useIntl();
  return (
    <XStack px="$2">
      <SizableText size="$headingLg">
        {intl.formatMessage({ id: 'title__assets' })}
      </SizableText>
    </XStack>
  );
}

export { DefiListHeader };
