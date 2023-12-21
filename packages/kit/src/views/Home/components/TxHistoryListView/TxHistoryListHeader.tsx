import { useIntl } from 'react-intl';

import { Text, XStack } from '@onekeyhq/components';

function TxHistoryListHeader() {
  const intl = useIntl();
  return (
    <XStack px="$2">
      <Text variant="$headingLg">
        {intl.formatMessage({ id: 'transaction__history' })}
      </Text>
    </XStack>
  );
}

export { TxHistoryListHeader };
