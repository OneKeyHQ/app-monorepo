import { useIntl } from 'react-intl';

import { Text, XStack } from '@onekeyhq/components';

function TxHistoryListHeader() {
  const intl = useIntl();
  return (
    <XStack>
      <Text variant="$headingLg">
        {intl.formatMessage({ id: 'transaction__history' })}
      </Text>
    </XStack>
  );
}

export { TxHistoryListHeader };
