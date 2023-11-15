import { useMemo } from 'react';

import { IconButton, XStack } from '@onekeyhq/components';

import HeaderLeftToolBar from '../HeaderLeftToolBar';

function MobileBrowserInfoBar({
  url,
  onSearch,
}: {
  id: string;
  url: string;
  onSearch: () => void;
}) {
  const content = useMemo(
    () => (
      <XStack w="100%" h="$11" px="$5" bg="$bgApp" alignItems="center">
        <HeaderLeftToolBar url={url} onSearch={onSearch} />
        <XStack space="$6" ml="$4">
          <IconButton
            size="medium"
            variant="tertiary"
            icon="PlaceholderOutline"
          />
          <IconButton
            size="medium"
            variant="tertiary"
            icon="PlaceholderOutline"
          />
        </XStack>
      </XStack>
    ),
    [url, onSearch],
  );
  return <>{content}</>;
}

export default MobileBrowserInfoBar;
