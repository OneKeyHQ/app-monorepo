import { useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { Button, Stack, XStack, YStack } from '@onekeyhq/components';
import type { ITradingViewChartMode } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import {
  type IMarketDetailChartDisplayMode,
  useMarketDetailChartDisplayModePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  type IStockSimpleChartRange,
  StockSimpleChart,
  TOKEN_SIMPLE_CHART_RANGES,
} from '../../components/StockSimpleChart';

import { MarketDetailProChartControls } from './MarketDetailProChartControls';

function TokenChartModeControl({
  mode,
  onChange,
}: {
  mode: IMarketDetailChartDisplayMode;
  onChange: (mode: IMarketDetailChartDisplayMode) => void;
}) {
  const intl = useIntl();

  return (
    <XStack height={32} alignItems="center" gap="$0.5">
      <Button
        testID="market-token-chart-mode-simple"
        minWidth={62}
        height={32}
        m="$0"
        px="$2"
        borderWidth={0}
        size="small"
        variant={mode === 'simple' ? 'secondary' : 'tertiary'}
        borderRadius="$full"
        onPress={() => onChange('simple')}
      >
        Simple
      </Button>
      <Button
        testID="market-token-chart-mode-pro"
        minWidth={40}
        height={32}
        m="$0"
        px="$2"
        borderWidth={0}
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

export function TokenDetailChart({
  marketAssetId,
  marketTradingView,
  isChartFullscreen,
  chartMode,
  isChartSwitchDisabled,
  onChartSwitch,
  onEnterChartFullscreen,
}: {
  marketAssetId?: string;
  marketTradingView: ReactNode;
  isChartFullscreen: boolean;
  chartMode: ITradingViewChartMode;
  isChartSwitchDisabled?: boolean;
  onChartSwitch: () => void;
  onEnterChartFullscreen: () => void;
}) {
  const intl = useIntl();
  const [{ mode }, setChartDisplayMode] =
    useMarketDetailChartDisplayModePersistAtom();
  const [range, setRange] = useState<IStockSimpleChartRange>('1D');
  const isSimpleMode = mode === 'simple' && !isChartFullscreen;
  const handleModeChange = (nextMode: IMarketDetailChartDisplayMode) => {
    setChartDisplayMode({ mode: nextMode });
  };

  return (
    <YStack width="100%" height="100%" position="relative">
      {isSimpleMode ? (
        <>
          <XStack
            testID="market-token-chart-toolbar"
            height={40}
            py="$1"
            alignItems="center"
            justifyContent="space-between"
          >
            <XStack alignItems="center" gap="$0.5">
              {TOKEN_SIMPLE_CHART_RANGES.map((item) => (
                <Button
                  key={item}
                  testID={`market-token-chart-range-${item}`}
                  minWidth={40}
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
            </XStack>
            <TokenChartModeControl mode={mode} onChange={handleModeChange} />
          </XStack>
          <StockSimpleChart
            marketAssetId={marketAssetId}
            range={range}
            priceMode="token"
          />
        </>
      ) : (
        <>
          <Stack flex={1} minWidth={0} overflow="hidden">
            {marketTradingView}
          </Stack>
          {isChartFullscreen ? null : (
            <MarketDetailProChartControls
              testID="market-token-chart-mode-control-pro"
              top={3}
              fullscreenTestID="trading-view-native-fullscreen-toggle"
              chartMode={chartMode}
              isChartSwitchDisabled={isChartSwitchDisabled}
              onChartSwitch={onChartSwitch}
              onEnterChartFullscreen={onEnterChartFullscreen}
            >
              <TokenChartModeControl mode={mode} onChange={handleModeChange} />
            </MarketDetailProChartControls>
          )}
        </>
      )}
    </YStack>
  );
}
