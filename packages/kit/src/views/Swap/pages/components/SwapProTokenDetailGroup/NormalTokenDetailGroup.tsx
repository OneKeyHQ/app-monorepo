import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { SwapProTokenDetailRows } from './SwapProTokenDetailRows';
import { renderCurrencyValue, renderHoldersValue } from './valueRenderers';

export function NormalTokenDetailGroup({
  tokenDetail,
  isNative,
}: {
  tokenDetail?: IMarketTokenDetail;
  isNative?: boolean;
}) {
  return (
    <SwapProTokenDetailRows
      rows={[
        {
          titleId: ETranslations.dexmarket_market_cap,
          valueComponent: renderCurrencyValue(tokenDetail?.marketCap),
        },
        {
          titleId: ETranslations.dexmarket_search_result_vol,
          valueComponent: renderCurrencyValue(tokenDetail?.volume24h),
        },
        {
          titleId: ETranslations.dexmarket_liquidity,
          valueComponent: renderCurrencyValue(tokenDetail?.liquidity),
        },
        {
          titleId: ETranslations.dexmarket_holders,
          valueComponent: renderHoldersValue({
            holders: tokenDetail?.holders,
            isNative,
          }),
        },
      ]}
    />
  );
}
