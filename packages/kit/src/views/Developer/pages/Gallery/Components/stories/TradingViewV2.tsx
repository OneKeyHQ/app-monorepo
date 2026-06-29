import { useCallback, useState } from 'react';

import {
  Button,
  Checkbox,
  Input,
  SizableText,
  Stack,
  Switch,
  XStack,
} from '@onekeyhq/components';
import {
  type ITradingViewDisabledFeature,
  TRADING_VIEW_DISABLED_FEATURES,
  TradingViewV2,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import { MarketWatchListProviderMirrorV2 } from '@onekeyhq/kit/src/views/Market/MarketWatchListProviderMirrorV2';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { Layout } from './utils/Layout';

const DISABLED_FEATURE_OPTIONS: {
  label: string;
  value: ITradingViewDisabledFeature;
}[] = [
  {
    label: 'Timeframe Selector',
    value: TRADING_VIEW_DISABLED_FEATURES.TIMEFRAME_SELECTOR,
  },
  { label: 'Time Scale', value: TRADING_VIEW_DISABLED_FEATURES.TIME_SCALE },
  { label: 'Price Scale', value: TRADING_VIEW_DISABLED_FEATURES.PRICE_SCALE },
  {
    label: 'Price / Market Cap',
    value: TRADING_VIEW_DISABLED_FEATURES.PRICE_MARKET_CAP_TOGGLE,
  },
  { label: 'Indicators', value: TRADING_VIEW_DISABLED_FEATURES.INDICATORS },
  { label: 'Settings', value: TRADING_VIEW_DISABLED_FEATURES.SETTINGS },
  { label: 'Chart Type', value: TRADING_VIEW_DISABLED_FEATURES.CHART_TYPE },
  { label: 'Reset Layout', value: TRADING_VIEW_DISABLED_FEATURES.RESET_LAYOUT },
  { label: 'Fullscreen', value: TRADING_VIEW_DISABLED_FEATURES.FULLSCREEN },
  {
    label: 'Layout / Split',
    value: TRADING_VIEW_DISABLED_FEATURES.LAYOUT_TOGGLE,
  },
  {
    label: 'Drawing Toolbar',
    value: TRADING_VIEW_DISABLED_FEATURES.DRAWING_TOOLBAR,
  },
  {
    label: 'Volume',
    value: TRADING_VIEW_DISABLED_FEATURES.VOLUME,
  },
];

const DEFAULT_ENABLED_NATIVE_CONTROL_FEATURES =
  new Set<ITradingViewDisabledFeature>([
    TRADING_VIEW_DISABLED_FEATURES.PRICE_SCALE,
    TRADING_VIEW_DISABLED_FEATURES.PRICE_MARKET_CAP_TOGGLE,
    TRADING_VIEW_DISABLED_FEATURES.INDICATORS,
    TRADING_VIEW_DISABLED_FEATURES.CHART_TYPE,
    TRADING_VIEW_DISABLED_FEATURES.RESET_LAYOUT,
  ]);
const ALL_DISABLED_FEATURES = DISABLED_FEATURE_OPTIONS.map(
  (option) => option.value,
);
const DEFAULT_DISABLED_FEATURES = ALL_DISABLED_FEATURES.filter(
  (feature) => !DEFAULT_ENABLED_NATIVE_CONTROL_FEATURES.has(feature),
);
const DEFAULT_STORAGE_NAMESPACE = 'tradingview-v2-demo';

const TradingViewV2Gallery = () => {
  const [disabledFeatures, setDisabledFeatures] = useState<
    ITradingViewDisabledFeature[]
  >(DEFAULT_DISABLED_FEATURES);
  const [storageNamespace, setStorageNamespace] = useState(
    DEFAULT_STORAGE_NAMESPACE,
  );
  const [enableNativeChartControls, setEnableNativeChartControls] =
    useState(true);

  const handleDisabledFeatureChange = useCallback(
    (feature: ITradingViewDisabledFeature, checked: boolean) => {
      setDisabledFeatures((currentFeatures) => {
        if (checked) {
          return currentFeatures.includes(feature)
            ? currentFeatures
            : [...currentFeatures, feature];
        }

        return currentFeatures.filter(
          (currentFeature) => currentFeature !== feature,
        );
      });
    },
    [],
  );

  const handleClearDisabledFeatures = useCallback(() => {
    setDisabledFeatures([]);
  }, []);

  const handleSelectAllDisabledFeatures = useCallback(() => {
    setDisabledFeatures([...ALL_DISABLED_FEATURES]);
  }, []);

  return (
    <MarketWatchListProviderMirrorV2
      storeName={EJotaiContextStoreNames.marketWatchListV2}
    >
      <Layout
        getFilePath={() => __CURRENT_FILE_PATH__}
        componentName="TradingViewV2"
        elements={[
          {
            title: 'Market USDC',
            element: (
              <Stack gap="$3">
                <Stack gap="$2">
                  <SizableText size="$bodySmMedium">
                    Storage namespace
                  </SizableText>
                  <Input
                    value={storageNamespace}
                    onChangeText={setStorageNamespace}
                    placeholder="storageNamespace"
                  />
                  <SizableText size="$bodySm">
                    {`storageNamespace=${storageNamespace || 'default'}`}
                  </SizableText>

                  <XStack alignItems="center" gap="$2">
                    <Switch
                      value={enableNativeChartControls}
                      onChange={setEnableNativeChartControls}
                    />
                    <SizableText size="$bodySm">
                      Native chart controls
                    </SizableText>
                  </XStack>
                  <SizableText size="$bodySm">
                    {`nativeChartControls=${
                      enableNativeChartControls ? 'on' : 'off'
                    }`}
                  </SizableText>

                  <XStack
                    alignItems="center"
                    justifyContent="space-between"
                    flexWrap="wrap"
                    gap="$2"
                  >
                    <SizableText size="$bodySmMedium">
                      Disabled features
                    </SizableText>
                    <XStack gap="$2" flexWrap="wrap">
                      <Button
                        size="small"
                        variant="secondary"
                        onPress={handleClearDisabledFeatures}
                      >
                        Clear all
                      </Button>
                      <Button
                        size="small"
                        variant="secondary"
                        onPress={handleSelectAllDisabledFeatures}
                      >
                        Select all
                      </Button>
                    </XStack>
                  </XStack>
                  <XStack flexWrap="wrap" gap="$3">
                    {DISABLED_FEATURE_OPTIONS.map((option) => (
                      <XStack key={option.value} alignItems="center" gap="$2">
                        <Checkbox
                          value={disabledFeatures.includes(option.value)}
                          onChange={(checked) => {
                            handleDisabledFeatureChange(
                              option.value,
                              !!checked,
                            );
                          }}
                        />
                        <SizableText size="$bodySm">{option.label}</SizableText>
                      </XStack>
                    ))}
                  </XStack>
                  <SizableText size="$bodySm">
                    {`disabledFeatures=${disabledFeatures.join(',') || 'none'}`}
                  </SizableText>
                </Stack>

                <Stack h={500} w="100%">
                  <TradingViewV2
                    symbol="USDC"
                    decimal={6}
                    networkId="evm--1"
                    tokenAddress="0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
                    disabledFeatures={disabledFeatures}
                    storageNamespace={storageNamespace}
                    enableNativeChartControls={enableNativeChartControls}
                  />
                </Stack>
              </Stack>
            ),
          },
          {
            title: 'Market Hyperliquid BTC',
            element: (
              <Stack h={500} w="100%">
                <TradingViewV2
                  symbol="BTC"
                  decimal={8}
                  networkId="btc--0"
                  tokenAddress=""
                  disabledFeatures={disabledFeatures}
                  storageNamespace={`${storageNamespace}-btc`}
                  enableNativeChartControls={enableNativeChartControls}
                />
              </Stack>
            ),
          },
        ]}
      />
    </MarketWatchListProviderMirrorV2>
  );
};

export default TradingViewV2Gallery;
