import { Icon, Stack } from '@onekeyhq/components';

import { MarketTokenIcon } from './MarketTokenIcon';

export function MarketTokenStarIcon({
  url,
  checked,
}: {
  url: string;
  checked: boolean;
}) {
  return (
    <Stack>
      <MarketTokenIcon uri={url} size="lg" />
      {checked ? (
        <Stack
          position="absolute"
          borderRadius="$full"
          p="$0.5"
          bg="$bgApp"
          right="$-1"
          top="$-1"
        >
          <Icon name="StarSolid" size="$3.5" />
        </Stack>
      ) : null}
    </Stack>
  );
}
