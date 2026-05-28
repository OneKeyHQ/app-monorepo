import type { IUseBtcMetadataResult } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useBtcMetadata';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SwapProTokenDetailRows } from './SwapProTokenDetailRows';
import { renderAmountValue, renderCurrencyValue } from './valueRenderers';

export function BtcTokenDetailGroup({
  btcMetadata,
}: {
  btcMetadata: IUseBtcMetadataResult;
}) {
  return (
    <SwapProTokenDetailRows
      rows={[
        {
          titleId: ETranslations.dexmarket_market_cap,
          valueComponent: renderCurrencyValue(btcMetadata.marketCap),
        },
        {
          titleId: ETranslations.dexmarket_search_result_vol,
          valueComponent: renderCurrencyValue(btcMetadata.volume24h),
        },
        {
          titleId: ETranslations.dexmarket_btc_total_supply,
          valueComponent: renderAmountValue(btcMetadata.totalSupply),
        },
        {
          titleId: ETranslations.dexmarket_btc_circulating,
          valueComponent: renderAmountValue(btcMetadata.circulatingSupply),
        },
      ]}
    />
  );
}
