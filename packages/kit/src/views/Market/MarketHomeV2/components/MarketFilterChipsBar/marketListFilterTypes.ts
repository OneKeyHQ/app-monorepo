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
  // dimension is selectable but has no local data source (e.g. inflow) and
  // is skipped by applyMarketListLocalFilter.
  localField?: keyof IMarketToken;
  // firstTradeTime is a timestamp; compare (now - value) against min/max.
  isAge?: boolean;
  group: EMarketFilterGroup;
  // Extra note rendered next to the row (demo caveats).
  note?: string;
  options: IMarketFilterOption[];
};

// A dimension's selection: either a tier option id from the config, or an
// inline option. Chips carry inline options because their thresholds are
// curated from experiments (see P2-9) and deliberately do not have to line up
// with the popover's user-facing tiers.
export type IMarketFilterSelection = string | IMarketFilterOption;

export type IMarketListFilterConditions = Partial<
  Record<EMarketFilterDimension, IMarketFilterSelection>
>;

export type IMarketListFilterState = {
  conditions: IMarketListFilterConditions;
  activeChipId?: string;
};

// Chip kinds share one row and one visual form on purpose; the difference is
// disclosed honestly in the tooltip rather than encoded in the styling.
export enum EMarketChipKind {
  // Dispatches an existing column sort — zero new state, zero API.
  Sort = 'sort',
  // Applies filter conditions (server passthrough once Spike A#8 lands).
  Filter = 'filter',
}

export type IMarketFilterChip = {
  id: string;
  label: string;
  kind: EMarketChipKind;
  // Leading icon; also reused as the group anchor icon in the applied state.
  icon: IKeyOfIcons;
  // Honest disclosure of what the chip actually does to the list.
  tooltip: string;
  // Sort chips: the column this chip sorts by (dataIndex), always descending.
  sortBy?: string;
  // Filter chips: the conditions applied.
  conditions?: IMarketListFilterConditions;
  // Every quick chip anchors the time frame (P2-9 定案).
  timeRange?: IMarketTimeRangeValue;
  // Demo caveat surfaced in the tooltip when the real behavior needs backend
  // work that does not exist yet (e.g. rankBy view switching).
  demoNote?: string;
};

// Sort lives next to the filter state because the chip row and the table
// header are two views of ONE sort action: a sort chip dispatches exactly what
// clicking that column header dispatches, so both read the same store and stay
// in sync (chip lights up on header click, and dims when another column wins).
export type IMarketListSortState = {
  sortBy?: string;
  sortType?: 'asc' | 'desc';
};

export type IMarketListFilterContextValue = {
  filterState: IMarketListFilterState;
  setFilterState: (next: IMarketListFilterState) => void;
  sortState: IMarketListSortState;
  // Accepts the updater form so consecutive sortBy/sortType writes merge.
  setSortState: Dispatch<SetStateAction<IMarketListSortState>>;
  activeConditionCount: number;
};
