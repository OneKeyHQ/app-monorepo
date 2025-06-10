import { useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketTokenKineResponse } from '@onekeyhq/shared/types/marketV2';

interface IUseTradingViewV2Props {
  tokenAddress: string;
  networkId: string;
  interval: string;
  timeFrom: number;
  timeTo: number;
}

export function useTradingViewV2({
  tokenAddress,
  networkId,
  interval,
  timeFrom,
  timeTo,
}: IUseTradingViewV2Props) {
  const [kineData, setKineData] = useState<IMarketTokenKineResponse | null>(
    null,
  );

  // Fetch kine data
  useEffect(() => {
    const fetchKineData = async () => {
      try {
        const data =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenKine({
            tokenAddress,
            networkId,
            interval,
            timeFrom,
            timeTo,
          });
        setKineData(data);
        console.log('Kine data fetched:', data);
      } catch (error) {
        console.error('Failed to fetch kine data:', error);
      }
    };

    void fetchKineData();
  }, [tokenAddress, networkId, interval, timeFrom, timeTo]);

  return {
    kineData,
  };
}
