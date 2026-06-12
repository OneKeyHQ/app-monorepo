import { useMemo } from 'react';

import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveAssetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { buildActiveTradeDisplay } from './useActiveTradeDisplayUtils';

export function useActiveTradeDisplay() {
  const [tradeInstrument] = useActiveTradeInstrumentAtom();
  const [perpsAsset] = usePerpsActiveAssetAtom();

  return useMemo(
    () => buildActiveTradeDisplay({ tradeInstrument, perpsAsset }),
    [tradeInstrument, perpsAsset],
  );
}
