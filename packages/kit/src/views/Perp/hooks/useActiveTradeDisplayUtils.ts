import type { IPerpsActiveAssetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  formatSpotPairDisplayName,
  getSpotTokenDisplayName,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import type { IActiveTradeInstrument } from '../../../states/jotai/contexts/hyperliquid/atoms';

export function buildActiveTradeDisplay({
  tradeInstrument,
  perpsAsset,
}: {
  tradeInstrument: IActiveTradeInstrument;
  perpsAsset: IPerpsActiveAssetAtom;
}) {
  if (tradeInstrument.mode === 'spot' && tradeInstrument?.universe) {
    const u = tradeInstrument.universe;
    return {
      mode: 'spot' as const,
      coin: tradeInstrument.coin,
      displayName: formatSpotPairDisplayName(u.baseName, u.quoteName),
      baseName: getSpotTokenDisplayName(u.baseName),
      rawBaseName: u.baseName,
      assetId: tradeInstrument.assetId,
    };
  }

  const coin = tradeInstrument.coin || perpsAsset.coin;
  const parsed = parseDexCoin(coin);
  const isPerpsAssetForCoin = perpsAsset.coin === coin;

  return {
    mode: 'perp' as const,
    coin,
    displayName: parsed.displayName,
    baseName: parsed.displayName,
    rawBaseName: parsed.displayName,
    assetId:
      tradeInstrument.assetId ??
      (isPerpsAssetForCoin ? perpsAsset.assetId : undefined),
  };
}
