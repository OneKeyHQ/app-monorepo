import type { FC } from 'react';

import { useMarketTokenItem } from '../../Market/hooks/useMarketToken';
import { FavoritButton } from '../../Market/MarketDetail';

export const FavoritedButton: FC<{
  coingeckoId?: string;
}> = ({ coingeckoId }) => {
  const marketTokenItem = useMarketTokenItem({
    coingeckoId,
  });

  if (!marketTokenItem) {
    return null;
  }

  return <FavoritButton tokenItem={marketTokenItem} />;
};
