import { Stack } from '@onekeyhq/components';
import type { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';

import { MarketStarV2 } from './MarketStarV2';

export function MarketListingStar({
  kind,
  listingId,
  from,
  tokenSymbol,
  tokenName,
  logoUrl,
  testID,
  customIconSize = '$4',
}: {
  kind: 'asset' | 'stock';
  listingId: string;
  from: EWatchlistFrom;
  tokenSymbol?: string;
  tokenName?: string;
  logoUrl?: string;
  testID?: string;
  customIconSize?: string;
}) {
  return (
    <Stack onPress={(event) => event.stopPropagation()}>
      <MarketStarV2
        testID={testID ?? `market-listing-star-${kind}-${listingId}`}
        tokenSymbol={tokenSymbol}
        tokenName={tokenName}
        logoUrl={logoUrl}
        assetId={kind === 'asset' ? listingId : undefined}
        stockId={kind === 'stock' ? listingId : undefined}
        chainId=""
        contractAddress=""
        from={from}
        size="small"
        customIconSize={customIconSize}
      />
    </Stack>
  );
}
