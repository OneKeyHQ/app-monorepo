import type { IKeyOfIcons } from '@onekeyhq/components';

import type { IMarketToken } from '../MarketTokenList/MarketTokenData';

// Filter dimensions shown to the user. Each dimension maps to a pair of
// hot-token v6 params (min/max) so bucket options can pass ranges upstream.
export enum EMarketFilterDimension {
  TokenAge = 'tokenAge',
  MarketCap = 'marketCap',
  Liquidity = 'liquidity',
  Turnover = 'turnover',
  Holders = 'holders',
  Change = 'change',
  Txns = 'txns',
}

// A selectable tier. Threshold dimensions use only `min` (floor semantics,
// label like "$5K+"); bucket dimensions use min+max ranges; token age uses
// only `max` interpreted as an age ceiling ("Under 48h").
export type IMarketFilterOption = {
  id: string;
  // Copy shown inside the tier pill (e.g. "$100K–$1M", "Under 1h", "$5K+").
  label: string;
  // Compressed copy for the condition chip in the toolbar (e.g. "< 1h").
  chipLabel: string;
  min?: number;
  max?: number;
};

export type IMarketFilterDimensionConfig = {
  id: EMarketFilterDimension;
  label: string; // hardcoded EN copy, demo only
  // hot-token v6 param names backing the future server passthrough.
  minParam?: string;
  maxParam?: string;
  // IMarketToken field backing the local demo filter; undefined = the
  // dimension is selectable but has no local data source (e.g. inflow) and
  // is skipped by applyMarketListLocalFilter.
  localField?: keyof IMarketToken;
  // firstTradeTime is a timestamp; compare (now - value) against min/max.
  isAge?: boolean;
  // Low-frequency dimensions grouped under "More" in the Filters popover.
  advanced?: boolean;
  // Extra note rendered next to the row (demo caveats).
  note?: string;
  options: IMarketFilterOption[];
};

// Selected option id per dimension.
export type IMarketListFilterConditions = Partial<
  Record<EMarketFilterDimension, string>
>;

export type IMarketListFilterState = {
  conditions: IMarketListFilterConditions;
  activePresetId?: string;
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
