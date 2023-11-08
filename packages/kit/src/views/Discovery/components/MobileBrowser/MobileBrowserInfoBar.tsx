import { useMemo } from 'react';

import { Image, Stack, Text } from '@onekeyhq/components';
// @ts-expect-error
import dAppFavicon from '@onekeyhq/kit/assets/dapp_favicon.png';

function MobileBrowserInfoBar({
  title,
  favicon,
  onSearch,
}: {
  id: string;
  title: string;
  favicon: string;
  onSearch: () => void;
}) {
  const content = useMemo(
    () => (
      <Stack
        w="100%"
        h="$12"
        px="$3"
        py="$2"
        flexDirection="row"
        alignItems="center"
        onPress={onSearch}
      >
        <Image
          style={{ width: 16, height: 16, marginRight: 8 }}
          source={{ uri: favicon }}
          defaultSource={dAppFavicon}
        />
        <Text>{title}</Text>
      </Stack>
    ),
    [title, favicon, onSearch],
  );
  return <>{content}</>;
}

export default MobileBrowserInfoBar;
