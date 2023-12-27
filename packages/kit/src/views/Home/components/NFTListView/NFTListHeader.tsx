import { useIntl } from 'react-intl';

import { SearchBar, XStack } from '@onekeyhq/components';

function NFTListHeader() {
  const intl = useIntl();
  return (
    <XStack p="$5" pb="$3">
      <SearchBar
        placeholder="Search..."
        containerProps={{
          flex: 1,
          mr: '$2.5',
          maxWidth: '$80',
        }}
      />
    </XStack>
  );
}

export { NFTListHeader };
