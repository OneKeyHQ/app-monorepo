import { useEffect, useState } from 'react';

import { SizableText, YStack } from '@onekeyhq/components';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { PriceChart } from './Chart';

export function TokenPriceChart({ coinGeckoId }: { coinGeckoId: string }) {
  const [points, setPoints] = useState<IMarketTokenChart>([]);
  useEffect(() => {
    void backgroundApiProxy.serviceMarket
      .fetchTokenChart(coinGeckoId, 1, 100)
      .then((response) => {
        setPoints(response);
      });
  }, [coinGeckoId]);
  return (
    <YStack $gtMd={{ px: '$5', flexGrow: 1 }}>
      <PriceChart data={points}>
        <SizableText>TimeControl</SizableText>
      </PriceChart>
    </YStack>
  );
}
