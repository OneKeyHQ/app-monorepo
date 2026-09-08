import { Stack } from '@onekeyhq/components';
import type { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';

import { MarketStarV2 } from './MarketStarV2';

export function MarketListingStar({
  kind,
  listingId,
  from,
}: {
  kind: 'asset' | 'stock';
  listingId: string;
  from: EWatchlistFrom;
}) {
  return (
    <Stack onPress={(event) => event.stopPropagation()}>
      <MarketStarV2
        testID={`market-listing-star-${kind}-${listingId}`}
        assetId={kind === 'asset' ? listingId : undefined}
        stockId={kind === 'stock' ? listingId : undefined}
        chainId=""
        contractAddress=""
        from={from}
        size="small"
        customIconSize="$4"
      />
    </Stack>
  );
}
