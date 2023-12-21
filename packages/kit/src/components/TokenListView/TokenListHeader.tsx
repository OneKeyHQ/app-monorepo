import { useIntl } from 'react-intl';

import { Button, SearchBar, XStack, useMedia } from '@onekeyhq/components';

function TokenListHeader() {
  const intl = useIntl();
  const media = useMedia();

  return (
    <XStack justifyContent="space-between">
      <SearchBar
        placeholder="Search token"
        containerProps={{
          flex: 1,
          mr: '$2.5',
          maxWidth: '$80',
        }}
      />
      <Button
        {...(media.gtMd && {
          icon: 'EyeOffOutline',
        })}
      >
        3 Hidden
      </Button>
    </XStack>
  );
}

export { TokenListHeader };
