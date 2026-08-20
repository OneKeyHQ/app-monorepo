import { TRADING_VIEW_NATIVE_SUB_INDICATORS } from '../chartIndicators/subIndicatorTypes';

import type {
  ITradingViewNativeSubIndicatorInstanceConfig,
  ITradingViewNativeSubIndicatorSettingsOverrides,
} from './types';
import type { ITradingViewNativeSubIndicator } from '../chartIndicators/subIndicatorTypes';

export type ITradingViewNativeSubIndicatorSettingsByIndicator = Partial<
  Record<
    ITradingViewNativeSubIndicator,
    ITradingViewNativeSubIndicatorSettingsOverrides
  >
>;

export function buildTradingViewNativeSubIndicatorInstanceConfigsFromController({
  activeIndicatorValues,
  settingsByIndicator,
}: {
  activeIndicatorValues: ReadonlySet<string>;
  settingsByIndicator?: ITradingViewNativeSubIndicatorSettingsByIndicator;
}): ITradingViewNativeSubIndicatorInstanceConfig[] {
  return TRADING_VIEW_NATIVE_SUB_INDICATORS.filter((indicator) =>
    activeIndicatorValues.has(indicator),
  ).map((indicator) => {
    const settings = settingsByIndicator?.[indicator];
    return {
      id: indicator,
      indicator,
      ...(settings ? { settings } : {}),
    };
  });
}
