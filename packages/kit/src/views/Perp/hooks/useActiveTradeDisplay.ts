import { usePerpsActiveAssetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  formatSpotPairDisplayName,
  getSpotTokenDisplayName,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';

export function useActiveTradeDisplay() {
  const [tradeInstrument] = useActiveTradeInstrumentAtom();
  const [perpsAsset] = usePerpsActiveAssetAtom();

  if (tradeInstrument.mode === 'spot' && tradeInstrument?.universe) {
    const u = tradeInstrument.universe;
    return {
      mode: 'spot' as const,
      coin: tradeInstrument.coin,
      displayName: formatSpotPairDisplayName(u.baseName, u.quoteName),
      baseName: getSpotTokenDisplayName(u.baseName),
      assetId: tradeInstrument.assetId,
    };
  }

  const coin = tradeInstrument.coin || perpsAsset.coin;
  const parsed = parseDexCoin(coin);

  return {
    mode: 'perp' as const,
    coin,
    displayName: parsed.displayName,
    baseName: parsed.displayName,
    assetId: tradeInstrument.assetId ?? perpsAsset.assetId,
  };
}
