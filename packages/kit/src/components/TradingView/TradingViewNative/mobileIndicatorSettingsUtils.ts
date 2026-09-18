import type {
  ITradingViewNativeAnyIndicatorId,
  ITradingViewNativeIndicatorSettings,
} from '@onekeyhq/shared/types/tradingViewNative';

import { normalizeTradingViewNativeIndicatorSettings } from './indicatorSettingsAdapter';

export function mergeMobileIndicatorSettings(
  current: ITradingViewNativeIndicatorSettings,
  next: ITradingViewNativeIndicatorSettings,
  indicatorId: ITradingViewNativeAnyIndicatorId,
): ITradingViewNativeIndicatorSettings {
  const normalized = normalizeTradingViewNativeIndicatorSettings(current);
  const scope = next.mainIndicators.some(
    (indicator) => indicator.id === indicatorId,
  )
    ? 'mainIndicators'
    : 'subIndicators';
  const updatedIndicator = next[scope].find(
    (indicator) => indicator.id === indicatorId,
  );
  if (!updatedIndicator) {
    return normalized;
  }
  const existingIndicator = normalized[scope].find(
    (indicator) => indicator.id === indicatorId,
  );
  const mergedIndicator = {
    ...updatedIndicator,
    active: existingIndicator?.active ?? updatedIndicator.active,
  };
  return {
    ...normalized,
    [scope]: existingIndicator
      ? normalized[scope].map((indicator) =>
          indicator.id === indicatorId ? mergedIndicator : indicator,
        )
      : [...normalized[scope], mergedIndicator],
  };
}
