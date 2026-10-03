import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  ScrollView,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import type { IMarketDetailChartDisplayMode } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  useMarketDetailChartDisplayModePersistAtom,
  useMarketPriceSourceAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  type IStockSimpleChartRange,
  StockSimpleChart,
  TOKEN_SIMPLE_CHART_RANGES,
} from '../components/StockSimpleChart';
import { useStockDetail } from '../hooks/StockDetailContext';

import { MARKET_SIMPLE_CHART_RANGE_MIN_WIDTH } from './components/marketSimpleChartConstants';

// Figma 26907:69491. The mobile simple diagram is a fixed 280px line, with
// the range row and Simple/Pro switch under it.
const MOBILE_SIMPLE_CHART_HEIGHT = 280;

const RANGE_ROW_STYLE = {
  flexGrow: 1,
  alignItems: 'center',
  gap: '$0.5',
} as const;

function ChartModeButton({
  selected,
  icon,
  label,
  testID,
  onPress,
}: {
  selected: boolean;
  icon: IKeyOfIcons;
  label: string;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Stack
      testID={testID}
      accessibilityLabel={label}
      accessibilityRole="button"
      width={32}
      height={32}
      alignItems="center"
      justifyContent="center"
      borderRadius="$full"
      bg={selected ? '$bgStrong' : '$transparent'}
      pressStyle={{ bg: selected ? '$bgStrongActive' : '$bgActive' }}
      onPress={onPress}
    >
      <Icon name={icon} size="$4.5" color="$icon" />
    </Stack>
  );
}

export function MobileChartModeControl() {
  const intl = useIntl();
  const [{ mode }, setChartDisplayMode] =
    useMarketDetailChartDisplayModePersistAtom();
  const handleModeChange = useCallback(
    (nextMode: IMarketDetailChartDisplayMode) => {
      setChartDisplayMode({ mode: nextMode });
    },
    [setChartDisplayMode],
  );

  return (
    <XStack alignItems="center" gap="$0.5" flexShrink={0}>
      <ChartModeButton
        testID="market-mobile-chart-mode-simple"
        label={intl.formatMessage({
          id: ETranslations.market_chart_mode_simple,
        })}
        icon="TradingViewLineOutline"
        selected={mode === 'simple'}
        onPress={() => handleModeChange('simple')}
      />
      <ChartModeButton
        testID="market-mobile-chart-mode-pro"
        label={intl.formatMessage({ id: ETranslations.dexmarket_pro })}
        icon="TradingViewCandlesOutline"
        selected={mode === 'pro'}
        onPress={() => handleModeChange('pro')}
      />
    </XStack>
  );
}

export function MobileSimpleChart({
  marketAssetId,
}: {
  marketAssetId?: string;
}) {
  const intl = useIntl();
  const [range, setRange] = useState<IStockSimpleChartRange>('1D');
  const { stockId } = useStockDetail();
  const [{ source: priceSource }] = useMarketPriceSourceAtom();
  // Share price is what draws the previous-close line. Crypto charts have no
  // stock id, so they stay on the token quote.
  const priceMode = stockId ? priceSource : 'token';

  return (
    <YStack width="100%" gap="$2" testID="market-mobile-simple-chart">
      <Stack height={MOBILE_SIMPLE_CHART_HEIGHT} width="100%">
        <StockSimpleChart
          marketAssetId={marketAssetId}
          range={range}
          priceMode={priceMode}
          priceScaleFormat={stockId ? 'stock' : undefined}
        />
      </Stack>
      <XStack px="$3.5" py="$1" gap="$3" alignItems="center" width="100%">
        <ScrollView
          horizontal
          flex={1}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={RANGE_ROW_STYLE}
        >
          {TOKEN_SIMPLE_CHART_RANGES.map((item) => (
            <Button
              key={item}
              testID={`market-mobile-chart-range-${item}`}
              minWidth={MARKET_SIMPLE_CHART_RANGE_MIN_WIDTH}
              height={32}
              m="$0"
              px="$2"
              borderWidth={0}
              size="small"
              variant={range === item ? 'secondary' : 'tertiary'}
              borderRadius="$full"
              onPress={() => setRange(item)}
            >
              {item === 'All'
                ? intl.formatMessage({ id: ETranslations.global_all })
                : item}
            </Button>
          ))}
        </ScrollView>
        <MobileChartModeControl />
      </XStack>
    </YStack>
  );
}
