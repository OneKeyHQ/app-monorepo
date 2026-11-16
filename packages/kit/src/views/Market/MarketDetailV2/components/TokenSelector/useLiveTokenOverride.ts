import { useEffect, useState } from 'react';

import type { IMarketTokenListLiveOverride } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenListBase';

let currentTokenLiveData: IMarketTokenListLiveOverride | undefined;
const listeners = new Set<
  (data: IMarketTokenListLiveOverride | undefined) => void
>();

function isSameLiveData(
  a: IMarketTokenListLiveOverride | undefined,
  b: IMarketTokenListLiveOverride | undefined,
) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.networkId === b.networkId &&
    a.address === b.address &&
    a.price === b.price &&
    a.change24h === b.change24h &&
    a.marketCap === b.marketCap &&
    a.liquidity === b.liquidity &&
    a.transactions === b.transactions &&
    a.uniqueTraders === b.uniqueTraders &&
    a.holders === b.holders &&
    a.turnover === b.turnover &&
    a.walletInfo?.buy === b.walletInfo?.buy &&
    a.walletInfo?.sell === b.walletInfo?.sell
  );
}

export function setCurrentTokenLiveData(
  next: IMarketTokenListLiveOverride | undefined,
) {
  if (isSameLiveData(currentTokenLiveData, next)) {
    return;
  }
  currentTokenLiveData = next;
  listeners.forEach((listener) => listener(next));
}

export function useLiveTokenOverride():
  | IMarketTokenListLiveOverride
  | undefined {
  const [liveData, setLiveData] = useState<
    IMarketTokenListLiveOverride | undefined
  >(() => currentTokenLiveData);

  useEffect(() => {
    setLiveData(currentTokenLiveData);
    listeners.add(setLiveData);
    return () => {
      listeners.delete(setLiveData);
    };
  }, []);

  if (!liveData?.networkId || liveData.address === undefined) {
    return undefined;
  }
  return liveData;
}
