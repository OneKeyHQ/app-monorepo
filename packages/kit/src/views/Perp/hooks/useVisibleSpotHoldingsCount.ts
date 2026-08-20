import { useMemo } from 'react';

import {
  usePerpsCustomSettingsAtom,
  useSpotAssetCtxsMapAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  type ISpotHoldingRawBalance,
  buildSpotTokenPriceLookup,
  getVisibleSpotHoldingsCount,
} from '../components/OrderInfoPanel/utils';

import { useSpotMetaMaps } from './useSpotMetaMaps';

export function useVisibleSpotHoldingsCount({
  balances,
  hasPerpsUsdc,
}: {
  balances: ISpotHoldingRawBalance[];
  hasPerpsUsdc: boolean;
}) {
  const [perpsCustomSettings] = usePerpsCustomSettingsAtom();
  const [priceMap] = useSpotAssetCtxsMapAtom();
  const { spotUniverses } = useSpotMetaMaps();
  const tokenPriceLookup = useMemo(
    () => buildSpotTokenPriceLookup({ spotUniverses, priceMap }),
    [priceMap, spotUniverses],
  );

  return useMemo(
    () =>
      getVisibleSpotHoldingsCount({
        balances,
        tokenPriceLookup,
        hideBelowThreshold: perpsCustomSettings.hideSmallSpotHoldings ?? false,
        hasPerpsUsdc,
      }),
    [
      balances,
      hasPerpsUsdc,
      perpsCustomSettings.hideSmallSpotHoldings,
      tokenPriceLookup,
    ],
  );
}
