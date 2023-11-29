import { useMemo } from 'react';

import { XStack } from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';

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
        <HeaderButtonGroup>
          <HeaderIconButton icon="PlaceholderOutline" />
          <HeaderIconButton icon="PlaceholderOutline" />
        </HeaderButtonGroup>
      </XStack>
    ),
    [url, onSearch],
  );
  return <>{content}</>;
}

export default MobileBrowserInfoBar;
