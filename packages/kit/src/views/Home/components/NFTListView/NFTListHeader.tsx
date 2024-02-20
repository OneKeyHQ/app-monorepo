import { SearchBar, XStack } from '@onekeyhq/components';

function NFTListHeader() {
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
