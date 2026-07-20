import {
  MARKET_FILTER_DIMENSION_MAP,
  getMarketFilterOption,
} from './marketListFilterConfig';

import type {
  EMarketFilterDimension,
  IMarketFilterSelection,
  IMarketListFilterConditions,
} from './marketListFilterTypes';
import type { IMarketToken } from '../MarketTokenList/MarketTokenData';

export function applyMarketListLocalFilter(
  tokens: IMarketToken[],
  conditions: IMarketListFilterConditions,
  nowMs: number = Date.now(),
): IMarketToken[] {
  const entries = Object.entries(conditions).filter(([dimensionId]) => {
    const dimension = MARKET_FILTER_DIMENSION_MAP.get(
      dimensionId as EMarketFilterDimension,
    );
    return dimension?.localField !== undefined;
  }) as [EMarketFilterDimension, IMarketFilterSelection][];
  if (entries.length === 0) {
    return tokens;
  }
  return tokens.filter((token) =>
    entries.every(([dimensionId, selection]) => {
      const dimension = MARKET_FILTER_DIMENSION_MAP.get(dimensionId);
      const option = getMarketFilterOption(dimensionId, selection);
      if (!dimension?.localField || !option) {
        return true;
      }
      const raw = token[dimension.localField] as number | undefined;
      if (raw === undefined || raw === null || Number.isNaN(raw)) {
        return false;
      }
      // Age dimensions store a ms epoch timestamp (same clock as Date.now());
      // convert to an age before comparing against the option range.
      const value = dimension.isAge ? nowMs - raw : raw;
      if (option.min !== undefined && value < option.min) {
        return false;
      }
      if (option.max !== undefined && value > option.max) {
        return false;
      }
      return true;
    }),
  );
}
