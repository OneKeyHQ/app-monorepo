import { MARKET_FILTER_FIELD_CONFIG_MAP } from './marketListFilterConfig';
import { EMarketFilterField } from './marketListFilterTypes';

import type { IMarketListFilterConditions } from './marketListFilterTypes';
import type { IMarketToken } from '../MarketTokenList/MarketTokenData';

export function applyMarketListLocalFilter(
  tokens: IMarketToken[],
  conditions: IMarketListFilterConditions,
  nowMs: number = Date.now(),
): IMarketToken[] {
  const entries = Object.entries(conditions).filter(
    ([field]) =>
      MARKET_FILTER_FIELD_CONFIG_MAP.get(field as EMarketFilterField)
        ?.localField !== undefined,
  ) as [EMarketFilterField, number][];
  if (entries.length === 0) {
    return tokens;
  }
  return tokens.filter((token) =>
    entries.every(([field, value]) => {
      const config = MARKET_FILTER_FIELD_CONFIG_MAP.get(field);
      if (!config?.localField) return true;
      const raw = token[config.localField] as number | undefined;
      if (raw === undefined || raw === null || Number.isNaN(raw)) {
        return false;
      }
      if (field === EMarketFilterField.TokenAgeMax) {
        // firstTradeTime is a ms epoch timestamp (same as Date.now()); convert
        // to age before comparing against the ms tier value.
        return nowMs - raw <= value;
      }
      return config.direction === 'gte' ? raw >= value : raw <= value;
    }),
  );
}
