import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import type { IMarketDetailChartDisplayMode } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// Shared by the Market stock detail chart and the Trade stock panel so the
// Simple/Pro switch reads the same wherever a stock chart appears.
export function StockChartModeControl({
  mode,
  onChange,
}: {
  mode: IMarketDetailChartDisplayMode;
  onChange: (mode: IMarketDetailChartDisplayMode) => void;
}) {
  const intl = useIntl();

  // Figma 26552:24685. The small button supplies the 18px leading icon $2
  // from its label, but its $2.5 padding only survives on `secondary`:
  // `tertiary` is hard-coded to $2 so it can sit inline like a link. The
  // design wants both states on the same box, so px is set here — without it
  // the pill jumps 2px per side as the selection moves.
  return (
    <XStack alignItems="center" gap="$0.5" flexShrink={0}>
      <Button
        testID="stock-chart-mode-simple"
        height={32}
        m="$0"
        px="$2.5"
        borderWidth={0}
        flexShrink={0}
        icon="TradingViewLineOutline"
        size="small"
        variant={mode === 'simple' ? 'secondary' : 'tertiary'}
        borderRadius="$full"
        onPress={() => onChange('simple')}
      >
        {intl.formatMessage({ id: ETranslations.market_chart_mode_simple })}
      </Button>
      <Button
        testID="stock-chart-mode-pro"
        height={32}
        m="$0"
        px="$2.5"
        borderWidth={0}
        flexShrink={0}
        icon="TradingViewCandlesOutline"
        size="small"
        variant={mode === 'pro' ? 'secondary' : 'tertiary'}
        borderRadius="$full"
        onPress={() => onChange('pro')}
      >
        {intl.formatMessage({ id: ETranslations.dexmarket_pro })}
      </Button>
    </XStack>
  );
}
