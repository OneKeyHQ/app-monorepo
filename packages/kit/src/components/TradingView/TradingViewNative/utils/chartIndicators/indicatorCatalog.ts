import {
  TRADING_VIEW_NATIVE_SUB_INDICATORS,
  isTradingViewNativeSubIndicator,
} from './subIndicatorTypes';
import {
  TRADING_VIEW_NATIVE_INDICATORS,
  isTradingViewNativeIndicator,
} from './types';

import type { ITradingViewNativeSubIndicator } from './subIndicatorTypes';
import type { ITradingViewNativeIndicator } from './types';

export { isTradingViewNativeSubIndicator } from './subIndicatorTypes';
export { isTradingViewNativeIndicator } from './types';

export const TRADING_VIEW_NATIVE_ALL_INDICATORS = [
  ...TRADING_VIEW_NATIVE_INDICATORS,
  ...TRADING_VIEW_NATIVE_SUB_INDICATORS,
] as const;

export type ITradingViewNativeAnyIndicator =
  (typeof TRADING_VIEW_NATIVE_ALL_INDICATORS)[number];

export type ITradingViewNativeIndicatorPlacement = 'main' | 'subpane';

export type ITradingViewNativeIndicatorCatalogEntry =
  | {
      id: ITradingViewNativeIndicator;
      label: string;
      placement: 'main';
    }
  | {
      id: ITradingViewNativeSubIndicator;
      label: string;
      placement: 'subpane';
    };

const MAIN_INDICATOR_CATALOG: readonly ITradingViewNativeIndicatorCatalogEntry[] =
  TRADING_VIEW_NATIVE_INDICATORS.map((id: ITradingViewNativeIndicator) => ({
    id,
    label: id,
    placement: 'main',
  }));

const SUB_INDICATOR_CATALOG: readonly ITradingViewNativeIndicatorCatalogEntry[] =
  TRADING_VIEW_NATIVE_SUB_INDICATORS.map(
    (id: ITradingViewNativeSubIndicator) => ({
      id,
      label: id,
      placement: 'subpane',
    }),
  );

export const TRADING_VIEW_NATIVE_INDICATOR_CATALOG: readonly ITradingViewNativeIndicatorCatalogEntry[] =
  [...MAIN_INDICATOR_CATALOG, ...SUB_INDICATOR_CATALOG];

const ALL_INDICATOR_SET = new Set<string>(TRADING_VIEW_NATIVE_ALL_INDICATORS);

export function isTradingViewNativeAnyIndicator(
  value: string,
): value is ITradingViewNativeAnyIndicator {
  return ALL_INDICATOR_SET.has(value);
}

export function resolveTradingViewNativeIndicatorId(
  value: string,
  fallbackLabel?: string,
): ITradingViewNativeAnyIndicator | null {
  if (isTradingViewNativeAnyIndicator(value)) {
    return value;
  }

  if (fallbackLabel && isTradingViewNativeAnyIndicator(fallbackLabel)) {
    return fallbackLabel;
  }

  return null;
}

export function getTradingViewNativeIndicatorPlacement(
  value: string,
): ITradingViewNativeIndicatorPlacement | null {
  if (isTradingViewNativeIndicator(value)) {
    return 'main';
  }

  if (isTradingViewNativeSubIndicator(value)) {
    return 'subpane';
  }

  return null;
}
