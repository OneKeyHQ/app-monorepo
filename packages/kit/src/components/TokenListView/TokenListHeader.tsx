import { useIntl } from 'react-intl';

import { Button, SearchBar, Text, XStack } from '@onekeyhq/components';

function TokenListHeader() {
  const intl = useIntl();
  return (
    <XStack>
      <SearchBar placeholder="Search token" />
      <Button>3 hiddens</Button>
    </XStack>
  );
}

export { TokenListHeader };
