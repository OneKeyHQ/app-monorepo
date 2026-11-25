import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatLocalizedNumberString } from '@onekeyhq/shared/src/utils/numberUtils';

import { usePerpLatestTrade } from '../../hooks/usePerpLatestTrade';
import { usePerpMarketForeground } from '../../hooks/usePerpMarketForeground';

export function MobilePerpLatestPrice({ coin }: { coin: string }) {
  const intl = useIntl();
  const foreground = usePerpMarketForeground();
  const { trade } = usePerpLatestTrade(coin, foreground);
  let color: '$text' | '$bgAccent' | '$bgCriticalStrong' = '$text';
  if (trade) {
    color = trade.side === 'B' ? '$bgAccent' : '$bgCriticalStrong';
  }

  return (
    <>
      <SizableText size="$bodySm" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.perp_token_selector_last_price,
        })}
      </SizableText>
      <SizableText
        testID="perp-market-latest-price"
        size="$heading2xl"
        color={color}
      >
        {trade ? formatLocalizedNumberString(trade.px) : '--'}
      </SizableText>
    </>
  );
}
