import { memo } from 'react';

import { SizableText, Stack } from '@onekeyhq/components';

function Holders() {
  return (
    <Stack flex={1} p="$4">
      <SizableText>Holders information will be displayed here</SizableText>
    </Stack>
  );
}

export default memo(Holders);
