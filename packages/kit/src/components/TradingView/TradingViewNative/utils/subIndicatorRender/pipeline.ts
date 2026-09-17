import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { calculateTradingViewNativeSubIndicator } from './calculators';
import { buildTradingViewNativeSubIndicatorRenderPane } from './model';
import { resolveTradingViewNativeSubIndicatorInstance } from './settings';

import type {
  ITradingViewNativeSubIndicatorCalculation,
  ITradingViewNativeSubIndicatorInstanceConfig,
  ITradingViewNativeSubIndicatorRenderPane,
  ITradingViewNativeSubIndicatorResolvedInstance,
} from './types';

export interface ITradingViewNativeSubIndicatorRenderSnapshot {
  calculation: ITradingViewNativeSubIndicatorCalculation;
  instance: ITradingViewNativeSubIndicatorResolvedInstance;
  pane: ITradingViewNativeSubIndicatorRenderPane;
}

export function createTradingViewNativeSubIndicatorRenderSnapshot({
  config,
  points,
}: {
  config: ITradingViewNativeSubIndicatorInstanceConfig;
  points: readonly IMarketTokenKLineDataPoint[];
}): ITradingViewNativeSubIndicatorRenderSnapshot {
  const instance = resolveTradingViewNativeSubIndicatorInstance(config);
  const calculation = calculateTradingViewNativeSubIndicator(instance, points);

  return {
    calculation,
    instance,
    pane: buildTradingViewNativeSubIndicatorRenderPane({
      calculation,
      instance,
    }),
  };
}

export function createTradingViewNativeSubIndicatorRenderSnapshots({
  configs,
  points,
}: {
  configs: readonly ITradingViewNativeSubIndicatorInstanceConfig[];
  points: readonly IMarketTokenKLineDataPoint[];
}): ITradingViewNativeSubIndicatorRenderSnapshot[] {
  return configs.map((config) =>
    createTradingViewNativeSubIndicatorRenderSnapshot({ config, points }),
  );
}
