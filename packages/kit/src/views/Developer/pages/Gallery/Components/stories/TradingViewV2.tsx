import { useCallback, useState } from 'react';

import {
  Checkbox,
  Input,
  SizableText,
  Stack,
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

const DEFAULT_DISABLED_FEATURES = DISABLED_FEATURE_OPTIONS.map(
  (option) => option.value,
);
const DEFAULT_STORAGE_NAMESPACE = 'tradingview-v2-demo';

const TradingViewV2Gallery = () => {
  const [disabledFeatures, setDisabledFeatures] = useState<
    ITradingViewDisabledFeature[]
  >(DEFAULT_DISABLED_FEATURES);
  const [storageNamespace, setStorageNamespace] = useState(
    DEFAULT_STORAGE_NAMESPACE,
  );

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

  return (
    <MarketWatchListProviderMirrorV2
      storeName={EJotaiContextStoreNames.marketWatchListV2}
    >
      <Layout
        getFilePath={() => __CURRENT_FILE_PATH__}
        componentName="TradingViewV2"
        elements={[
          {
            title: 'Market Hyperliquid BTC',
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

                  <SizableText size="$bodySmMedium">
                    Disabled features
                  </SizableText>
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
                    symbol="BTC"
                    decimal={8}
                    networkId="btc--0"
                    tokenAddress=""
                    disabledFeatures={disabledFeatures}
                    storageNamespace={storageNamespace}
                  />
                </Stack>
              </Stack>
            ),
          },
        ]}
      />
    </MarketWatchListProviderMirrorV2>
  );
};

export default TradingViewV2Gallery;
