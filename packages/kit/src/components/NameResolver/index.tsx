import { useIntl } from 'react-intl';

import { Spinner, Text, XStack } from '@onekeyhq/components';

function NameResolver() {
  const intl = useIntl();

  return (
    <XStack py="$2" flexDirection="row">
      <Spinner size="small" />
      <Text ml="$3" color="$textSubdued">
        {intl.formatMessage({ id: 'message__fetching_addresses' })}
      </Text>
    </XStack>
  );
}

export { NameResolver };
