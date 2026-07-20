import type { Dispatch, SetStateAction } from 'react';

import type { IKeyOfIcons } from '@onekeyhq/components';

import type { IMarketTimeRangeValue } from '../../types';
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
// label like "$5K+"); token age uses only `max`, read as an age ceiling.
export type IMarketFilterOption = {
  id: string;
  // Copy shown inside the tier pill (e.g. "500K+", "≤ 48h").
  label: string;
  // Copy for the condition chip in the toolbar, which carries no row title
  // and so has to spell out the unit (e.g. "$500K+").
  chipLabel: string;
  min?: number;
  max?: number;
};

// Section groups in the Filters modal: named groups on one scrolling page
// instead of tabs.
export enum EMarketFilterGroup {
  Metrics = 'metrics',
  Audit = 'audit',
}

export type IMarketFilterDimensionConfig = {
  id: EMarketFilterDimension;
  label: string; // hardcoded EN copy, demo only
  // Optional unit shown after the label in the Filters popover row title.
  unit?: string;
  // hot-token v6 param names backing the future server passthrough.
  minParam?: string;
  maxParam?: string;
  // IMarketToken field backing the local demo filter; undefined = the
  // dimension is selectable but has no local data source and is skipped by
  // applyMarketListLocalFilter.
  localField?: keyof IMarketToken;
  // firstTradeTime is a timestamp; compare (now - value) against min/max.
  isAge?: boolean;
  // Filters the slice already in hand rather than the upstream pool. Token age
  // is the only such row (no server-side age param exists), and the PRD
  // requires the popover to mark it as behaving differently.
  isLocalOnly?: boolean;
  group: EMarketFilterGroup;
  // Extra note rendered next to the row (demo caveats).
  note?: string;
  options: IMarketFilterOption[];
};

// Selected tier option id per dimension. Chip conditions must be expressible
// here too ("chip 值 ⊆ 檔位集"): a chip whose threshold has no tier could not
// stay in sync with the popover, so every chip value exists in the tier table.
export type IMarketListFilterConditions = Partial<
  Record<EMarketFilterDimension, string>
>;

export type IMarketListFilterState = {
  conditions: IMarketListFilterConditions;
};

export type IMarketListSortState = {
  sortBy?: string;
  sortType?: 'asc' | 'desc';
};

export type IMarketFilterChip = {
  id: string;
  label: string;
  // Leading icon; also reused as the group anchor icon once expanded.
  icon: IKeyOfIcons;
  // Honest disclosure of what the chip does to the list (P1-2 wording).
  tooltip: string;
  // Conditions the chip applies. Every value is a tier option id.
  conditions: IMarketListFilterConditions;
  // Sort the chip dispatches, if any. Same state machine as the column header
  // (P1-10), so the header arrow and the chip can never disagree.
  sort?: IMarketListSortState;
  // Quick chips anchor the time frame; the popover stays free (P2-9).
  timeRange?: IMarketTimeRangeValue;
};

export type IMarketListFilterContextValue = {
  filterState: IMarketListFilterState;
  sortState: IMarketListSortState;
  // Applies conditions. Sort resets unless `sort` is given, because switching
  // the filtered slice invalidates the previous ordering (P2-9 × P1-10).
  applyConditions: (
    conditions: IMarketListFilterConditions,
    options?: { sort?: IMarketListSortState },
  ) => void;
  setSortState: Dispatch<SetStateAction<IMarketListSortState>>;
  activeConditionCount: number;
};
