import { useMemo } from 'react';

import { XStack } from '@onekeyhq/components';

import HeaderLeftToolBar from '../HeaderLeftToolBar';
import HeaderRightToolBar from '../HeaderRightToolBar';

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
        <HeaderRightToolBar />
      </XStack>
    ),
    [url, onSearch],
  );
  return <>{content}</>;
}

export default MobileBrowserInfoBar;
