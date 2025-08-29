import { useAtom } from 'jotai';

import { useWebData2Atom } from '../../../states/jotai/contexts/hyperliquid';

export function usePerpPositions() {
  const [webData2] = useWebData2Atom();
  const userPositions = webData2?.clearinghouseState.assetPositions || [];
  console.log('userPositions', userPositions);
  return userPositions;
}

export function usePerpOrders() {
  const [webData2] = useWebData2Atom();
  const userOpenOrders = webData2?.openOrders || [];
  console.log('userOpenOrders', userOpenOrders);
  return userOpenOrders;
}