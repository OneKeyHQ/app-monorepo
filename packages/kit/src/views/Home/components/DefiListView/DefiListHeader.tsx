import { useIntl } from 'react-intl';

import { Text, XStack } from '@onekeyhq/components';

function DefiListHeader() {
  const intl = useIntl();
  return (
    <XStack px="$2">
      <Text variant="$headingLg">
        {intl.formatMessage({ id: 'title__assets' })}
      </Text>
    </XStack>
  );
}

export { DefiListHeader };
