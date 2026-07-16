import { YStack } from '@onekeyhq/components';

import {
  TradingViewChartSettings,
  TradingViewChartSettingsMockGallery,
} from './TradingViewChartSettings';
import {
  TradingViewIndicatorSettings,
  TradingViewIndicatorSettingsMockGallery,
} from './TradingViewIndicatorSettings';

export {
  TradingViewChartSettings,
  TradingViewChartSettingsMockGallery,
  TradingViewIndicatorSettings,
  TradingViewIndicatorSettingsMockGallery,
};
export type { ITradingViewChartSettingsProps } from './TradingViewChartSettings';
export type { ITradingViewIndicatorSettingsProps } from './TradingViewIndicatorSettings';

export function TradingViewSettingsMockGallery() {
  return (
    <YStack gap="$8">
      <TradingViewChartSettingsMockGallery />
      <TradingViewIndicatorSettingsMockGallery />
    </YStack>
  );
}
