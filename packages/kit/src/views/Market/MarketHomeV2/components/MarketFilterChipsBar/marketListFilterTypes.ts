import type { IKeyOfIcons } from '@onekeyhq/components';

import type { IMarketToken } from '../MarketTokenList/MarketTokenData';

export enum EMarketFilterField {
  TokenAgeMax = 'tokenAgeMax',
  LiquidityMin = 'liquidityMin',
  MarketCapMin = 'marketCapMin',
  TurnoverMin = 'volumeMin',
  HoldersMin = 'holdersMin',
  ChangePercentMin = 'priceChangePercentMin',
  TxnsMin = 'txsMin',
  TradersMin = 'uniqueTraderMin',
  InflowUsdMin = 'inflowUsdMin',
}

export type IMarketListFilterConditions = Partial<
  Record<EMarketFilterField, number>
>;

export type IMarketListFilterState = {
  conditions: IMarketListFilterConditions;
  activePresetId?: string;
};

export type IMarketFilterTier = { label: string; value: number };

export type IMarketFilterFieldConfig = {
  field: EMarketFilterField;
  label: string; // hardcoded EN copy per design, demo only
  // '<=' for TokenAgeMax, '>=' for the rest
  direction: 'lte' | 'gte';
  tiers: IMarketFilterTier[];
  // IMarketToken field backing the local demo filter; undefined = the
  // condition is selectable but has no local data source (e.g. inflow) and
  // is skipped by applyMarketListLocalFilter.
  localField?: keyof IMarketToken;
  formatValue: (value: number) => string; // e.g. 100_000 -> '$100K'
};

export type IMarketFilterPreset = {
  id: string;
  label: string;
  // Leading icon; also reused as the group anchor icon in the applied state.
  icon: IKeyOfIcons;
  conditions: IMarketListFilterConditions;
};

export type IMarketListFilterContextValue = {
  filterState: IMarketListFilterState;
  setFilterState: (next: IMarketListFilterState) => void;
  // Bumped on every conditions change; consumers use it to reset sort state.
  filterRevision: number;
  activeConditionCount: number;
};
