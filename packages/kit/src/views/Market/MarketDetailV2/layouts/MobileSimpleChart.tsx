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
import { resolveDisplayedStockPriceMode } from '../hooks/useStockPriceSource';

import { MARKET_SIMPLE_CHART_RANGE_MIN_WIDTH } from './components/marketSimpleChartConstants';

// Keep the chart height stable when switching ranges.
const MOBILE_SIMPLE_CHART_HEIGHT = 280;

const RANGE_ROW_STYLE = {
  flexGrow: 1,
  alignItems: 'center',
  gap: '$0.5',
} as const;

function ChartModeButton({
  icon,
  label,
  testID,
  onPress,
}: {
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
      bg="$bgStrong"
      pressStyle={{ bg: '$bgStrongActive' }}
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
  const nextMode = mode === 'simple' ? 'pro' : 'simple';
  const handleModeChange = useCallback(() => {
    setChartDisplayMode({ mode: nextMode });
  }, [nextMode, setChartDisplayMode]);

  return (
    <ChartModeButton
      testID={`market-mobile-chart-mode-${nextMode}`}
      label={intl.formatMessage({
        id:
          nextMode === 'simple'
            ? ETranslations.market_chart_mode_simple
            : ETranslations.dexmarket_pro,
      })}
      icon={
        nextMode === 'simple'
          ? 'TradingViewLineOutline'
          : 'TradingViewCandlesOutline'
      }
      onPress={handleModeChange}
    />
  );
}

export function MobileSimpleChart({
  marketAssetId,
}: {
  marketAssetId?: string;
}) {
  const intl = useIntl();
  const [range, setRange] = useState<IStockSimpleChartRange>('1D');
  const { stockId, isStockDetailError } = useStockDetail();
  const [{ source: priceSource }] = useMarketPriceSourceAtom();
  // Share price is what draws the previous-close line. Crypto charts, and
  // stock tokens whose share quote cannot load, stay on the token quote.
  const priceMode = resolveDisplayedStockPriceMode({
    stockId,
    isStockDetailError,
    storedPriceMode: priceSource,
  });

  return (
    <YStack width="100%" gap="$2" testID="market-mobile-simple-chart">
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
      <Stack height={MOBILE_SIMPLE_CHART_HEIGHT} width="100%">
        <StockSimpleChart
          marketAssetId={marketAssetId}
          range={range}
          priceMode={priceMode}
          priceScaleFormat={stockId ? 'stock' : undefined}
        />
      </Stack>
    </YStack>
  );
}
