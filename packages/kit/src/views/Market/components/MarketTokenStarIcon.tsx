import { Icon, Stack } from '@onekeyhq/components';
import type { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/market/scenes/token';

import { useStarChecked } from './MarketStar';
import { MarketTokenIcon } from './MarketTokenIcon';

export function MarketTokenStarIcon({
  url,
  tabIndex,
  coingeckoId,
  from,
}: {
  url: string;
  tabIndex?: number;
  coingeckoId: string;
  from: EWatchlistFrom;
}) {
  const { checked } = useStarChecked({
    tabIndex,
    coingeckoId,
    from,
  });
  return checked ? (
    <Stack>
      <MarketTokenIcon uri={url} size="$10" />
      <Stack
        position="absolute"
        borderRadius="$full"
        p="$0.5"
        bg="$bgApp"
        right={-1}
        top={-1}
      >
        <Icon name="StarSolid" size="$3.5" />
      </Stack>
    </Stack>
  ) : (
    <MarketTokenIcon uri={url} size="$10" />
  );
}
