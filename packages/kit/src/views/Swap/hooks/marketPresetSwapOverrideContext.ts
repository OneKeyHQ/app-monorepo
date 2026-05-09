import type { IMarketPresetTokenContext } from '@onekeyhq/shared/types/swap/types';

import type { EMarketPresetTradeSide } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/marketPresetSettings';

export function buildMarketPresetSwapOverrideContextKey({
  marketPresetToken,
  tradeSide,
}: {
  marketPresetToken: IMarketPresetTokenContext;
  tradeSide: EMarketPresetTradeSide;
}) {
  return [
    marketPresetToken.networkId,
    marketPresetToken.contractAddress?.toLowerCase() ?? '',
    marketPresetToken.isNative ? 'native' : 'token',
    tradeSide,
  ].join('|');
}
