import type { IPerpDynamicTab } from '@onekeyhq/kit-bg/src/services/ServiceWebviewPerp/ServiceWebviewPerp';
import type {
  IPerpTokenSelectorConfig,
  IPerpTokenSortDirection,
  IPerpTokenSortField,
} from '@onekeyhq/shared/types/hyperliquid';
import {
  DEFAULT_PERP_TOKEN_ACTIVE_TAB,
  DEFAULT_PERP_TOKEN_SORT_DIRECTION,
  DEFAULT_PERP_TOKEN_SORT_FIELD,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

type IFixedTabNames = Record<'favorites' | 'all' | 'perps' | 'spot', string>;
type ITokenSelectorSortValue = string | number | null | undefined;
type IPerpTokenSelectorPrimaryTabId = 'favorites' | 'perps' | 'spot';
type IPerpTokenSelectorSortSnapshotKey = {
  field?: string;
  direction?: string;
  sortSource?: IPerpTokenSelectorConfig['sortSource'];
  sortSourceTab?: IPerpTokenSelectorConfig['sortSourceTab'];
};
type IPerpTokenSelectorDynamicTabItem = {
  tokenName?: string;
};

const PRIMARY_TAB_IDS = ['favorites', 'perps', 'spot'] as const;
const FIXED_TAB_IDS = ['favorites', 'all', 'perps', 'spot'] as const;
const ALL_TAB_IDS = new Set(['all']);
const PERPS_TAB_IDS = new Set(['perps']);
const PRIMARY_TAB_ID_SET = new Set<string>(PRIMARY_TAB_IDS);

function normalizeTabId(tabId: string) {
  return tabId.trim().toLowerCase();
}

function getCanonicalTabId(tabId: string) {
  const normalizedTabId = normalizeTabId(tabId);
  if (
    normalizedTabId === 'favorites' ||
    normalizedTabId === 'all' ||
    normalizedTabId === 'perps' ||
    normalizedTabId === 'spot'
  ) {
    return normalizedTabId;
  }
  return tabId.trim();
}

function buildPrimaryTabs(fixedTabNames: IFixedTabNames): IPerpDynamicTab[] {
  return PRIMARY_TAB_IDS.map((tabId) => ({
    tabId,
    name: fixedTabNames[tabId],
    tokens: [],
  }));
}

function normalizeServerTabs(serverTabs: IPerpDynamicTab[] | null | undefined) {
  const seenTabIds = new Set<string>();
  return (serverTabs ?? []).reduce<IPerpDynamicTab[]>((result, tab) => {
    const tabId = tab?.tabId?.trim();
    const name = tab?.name?.trim();
    if (!tabId || !name) {
      return result;
    }

    const canonicalTabId = getCanonicalTabId(tabId);
    const normalizedTabId = normalizeTabId(canonicalTabId);
    if (seenTabIds.has(normalizedTabId)) {
      return result;
    }
    seenTabIds.add(normalizedTabId);

    result.push({
      ...tab,
      tabId: canonicalTabId,
      name,
      tokens: Array.isArray(tab.tokens) ? tab.tokens : [],
    });
    return result;
  }, []);
}

function buildPerpTokenSelectorTabs({
  serverTabs,
  fixedTabNames,
}: {
  serverTabs: IPerpDynamicTab[] | null | undefined;
  fixedTabNames: IFixedTabNames;
}) {
  const primaryTabs = buildPrimaryTabs(fixedTabNames);
  const categoryTabs = buildPerpTokenSelectorCategoryTabs({
    serverTabs,
    fixedTabNames,
  });
  return [...primaryTabs, ...categoryTabs];
}

function buildPerpTokenSelectorCategoryTabs({
  serverTabs,
  fixedTabNames,
}: {
  serverTabs: IPerpDynamicTab[] | null | undefined;
  fixedTabNames: IFixedTabNames;
}) {
  const categoryAllTab: IPerpDynamicTab = {
    tabId: 'perps',
    name: fixedTabNames.all,
    tokens: [],
  };
  const normalizedServerTabs = normalizeServerTabs(serverTabs);
  const fixedTabIdSet = new Set<string>(FIXED_TAB_IDS);
  const serverCategoryTabs = normalizedServerTabs.filter(
    (tab) => !fixedTabIdSet.has(tab.tabId),
  );
  return [categoryAllTab, ...serverCategoryTabs];
}

function isPerpTokenSelectorAllTab(tabId: string) {
  return ALL_TAB_IDS.has(normalizeTabId(tabId));
}

function isPerpTokenSelectorPerpsTab(tabId: string) {
  return PERPS_TAB_IDS.has(normalizeTabId(tabId));
}

function isPerpTokenSelectorFavoritesTab(tabId: string) {
  return normalizeTabId(tabId) === 'favorites';
}

function isPerpTokenSelectorSpotTab(tabId: string) {
  return normalizeTabId(tabId) === 'spot';
}

function getPerpTokenSelectorFallbackTabId(tabs: IPerpDynamicTab[]) {
  return (
    tabs.find((tab) => isPerpTokenSelectorPerpsTab(tab.tabId))?.tabId ??
    tabs.find((tab) => isPerpTokenSelectorAllTab(tab.tabId))?.tabId ??
    tabs[0]?.tabId ??
    'perps'
  );
}

function getPerpTokenSelectorPrimaryTabId(
  activeTab: string,
): IPerpTokenSelectorPrimaryTabId {
  const normalizedTabId = normalizeTabId(activeTab);
  if (normalizedTabId === 'favorites' || normalizedTabId === 'spot') {
    return normalizedTabId;
  }
  return 'perps';
}

function isPerpTokenSelectorPrimaryTab(tabId: string) {
  return PRIMARY_TAB_ID_SET.has(normalizeTabId(tabId));
}

function isPerpTokenSelectorDynamicTabUserSort({
  activeTab,
  sortSource,
  sortSourceTab,
}: {
  activeTab?: string;
  sortSource?: IPerpTokenSelectorConfig['sortSource'];
  sortSourceTab?: IPerpTokenSelectorConfig['sortSourceTab'];
}) {
  const currentActiveTab = activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB;
  if (isPerpTokenSelectorPrimaryTab(currentActiveTab)) {
    return false;
  }
  return (
    sortSource === 'user' &&
    sortSourceTab !== undefined &&
    normalizeTabId(sortSourceTab) === normalizeTabId(currentActiveTab)
  );
}

function isMissingSortValue(value: ITokenSelectorSortValue) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'number' && !Number.isFinite(value)) ||
    (typeof value === 'string' && value.length === 0)
  );
}

function comparePerpTokenSelectorSortValues({
  a,
  b,
  direction,
}: {
  a: ITokenSelectorSortValue;
  b: ITokenSelectorSortValue;
  direction: IPerpTokenSortDirection;
}) {
  const aMissing = isMissingSortValue(a);
  const bMissing = isMissingSortValue(b);
  if (aMissing || bMissing) {
    if (aMissing && bMissing) {
      return 0;
    }
    return aMissing ? 1 : -1;
  }

  const compareResult =
    typeof a === 'string' || typeof b === 'string'
      ? String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })
      : Number(a) - Number(b);
  return direction === 'asc' ? compareResult : -compareResult;
}

function sortPerpTokenSelectorItemsBySortValue<T>({
  items,
  getValue,
  direction,
}: {
  items: T[];
  getValue: (item: T) => ITokenSelectorSortValue;
  direction: IPerpTokenSortDirection;
}) {
  return items
    .map((item, index) => ({
      item,
      index,
      sortValue: getValue(item),
    }))
    .toSorted(
      (a, b) =>
        comparePerpTokenSelectorSortValues({
          a: a.sortValue,
          b: b.sortValue,
          direction,
        }) || a.index - b.index,
    )
    .map(({ item }) => item);
}

function sortPerpTokenSelectorItemsByServerOrder<T>({
  items,
  tokenOrder,
  getTokenName,
}: {
  items: T[];
  tokenOrder: string[];
  getTokenName: (item: T) => string | undefined;
}) {
  const tokenRank = new Map<string, number>();
  tokenOrder.forEach((token, index) => {
    if (!tokenRank.has(token)) {
      tokenRank.set(token, index);
    }
  });
  return items
    .map((item, index) => {
      const tokenName = getTokenName(item);
      return {
        item,
        index,
        rank:
          tokenName && tokenRank.has(tokenName)
            ? (tokenRank.get(tokenName) ?? Number.MAX_SAFE_INTEGER)
            : Number.MAX_SAFE_INTEGER,
      };
    })
    .toSorted((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ item }) => item);
}

function getPerpTokenSelectorDynamicTabItems<
  T extends IPerpTokenSelectorDynamicTabItem,
>({
  items,
  tokens,
  useSortedItemsOrder,
}: {
  items: T[];
  tokens: string[];
  useSortedItemsOrder?: boolean;
}) {
  const tokenNameSet = new Set(
    tokens.map((token) => token.trim()).filter(Boolean),
  );
  if (useSortedItemsOrder) {
    return items.filter((item) => {
      const tokenName = item.tokenName?.trim();
      return tokenName ? tokenNameSet.has(tokenName) : false;
    });
  }

  const itemsByTokenName = new Map<string, T[]>();
  items.forEach((item) => {
    const tokenName = item.tokenName?.trim();
    if (!tokenName) {
      return;
    }
    const tokenItems = itemsByTokenName.get(tokenName) ?? [];
    tokenItems.push(item);
    itemsByTokenName.set(tokenName, tokenItems);
  });

  const usedItems = new Set<T>();
  return tokens.reduce<T[]>((result, token) => {
    const tokenName = token.trim();
    const tokenItems = tokenName ? itemsByTokenName.get(tokenName) : undefined;
    tokenItems?.forEach((item) => {
      if (!usedItems.has(item)) {
        usedItems.add(item);
        result.push(item);
      }
    });
    return result;
  }, []);
}

function isPerpTokenSelectorSortFieldActive({
  activeTab,
  field,
  sortField,
  sortSource,
  sortSourceTab,
}: {
  activeTab?: string;
  field: IPerpTokenSortField;
  sortField?: IPerpTokenSortField;
  sortSource?: IPerpTokenSelectorConfig['sortSource'];
  sortSourceTab?: IPerpTokenSelectorConfig['sortSourceTab'];
}) {
  const currentActiveTab = activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB;
  const isDynamicTab = !isPerpTokenSelectorPrimaryTab(currentActiveTab);
  return (
    sortField === field &&
    (!isDynamicTab ||
      isPerpTokenSelectorDynamicTabUserSort({
        activeTab: currentActiveTab,
        sortSource,
        sortSourceTab,
      }))
  );
}

function getNextPerpTokenSelectorActiveTabConfig({
  prev,
  tab,
}: {
  prev: IPerpTokenSelectorConfig | null;
  tab: string;
}): IPerpTokenSelectorConfig {
  return {
    field: prev?.field ?? DEFAULT_PERP_TOKEN_SORT_FIELD,
    direction: prev?.direction ?? DEFAULT_PERP_TOKEN_SORT_DIRECTION,
    activeTab: tab,
    sortSource: 'default',
    sortSourceTab: undefined,
  };
}

function getNextPerpTokenSelectorSortConfig({
  prev,
  field,
}: {
  prev: IPerpTokenSelectorConfig | null;
  field: IPerpTokenSortField;
}): IPerpTokenSelectorConfig {
  const activeTab = prev?.activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB;
  const isCurrentFieldActive = isPerpTokenSelectorSortFieldActive({
    activeTab,
    field,
    sortField: prev?.field,
    sortSource: prev?.sortSource,
    sortSourceTab: prev?.sortSourceTab,
  });

  if (isCurrentFieldActive) {
    if (prev?.direction === 'asc') {
      return {
        field: DEFAULT_PERP_TOKEN_SORT_FIELD,
        direction: DEFAULT_PERP_TOKEN_SORT_DIRECTION,
        activeTab,
        sortSource: 'default',
        sortSourceTab: undefined,
      };
    }
    return {
      field,
      direction: 'asc',
      activeTab,
      sortSource: 'user',
      sortSourceTab: activeTab,
    };
  }

  return {
    field,
    direction: DEFAULT_PERP_TOKEN_SORT_DIRECTION,
    activeTab,
    sortSource: 'user',
    sortSourceTab: activeTab,
  };
}

function getPerpTokenSelectorSortAssetCtxsByDex<T>({
  snapshotAssetCtxsByDex,
}: {
  snapshotAssetCtxsByDex: T;
}) {
  return snapshotAssetCtxsByDex;
}

function shouldRefreshPerpTokenSelectorSortSnapshot({
  lastSort,
  field,
  direction,
  sortSource,
  sortSourceTab,
  snapshotEmpty,
}: {
  lastSort: IPerpTokenSelectorSortSnapshotKey | null;
  field?: string;
  direction?: string;
  sortSource?: IPerpTokenSelectorConfig['sortSource'];
  sortSourceTab?: IPerpTokenSelectorConfig['sortSourceTab'];
  snapshotEmpty: boolean;
}) {
  return (
    lastSort?.field !== field ||
    lastSort?.direction !== direction ||
    lastSort?.sortSource !== sortSource ||
    lastSort?.sortSourceTab !== sortSourceTab ||
    snapshotEmpty
  );
}

export {
  buildPrimaryTabs,
  buildPerpTokenSelectorCategoryTabs,
  buildPerpTokenSelectorTabs,
  comparePerpTokenSelectorSortValues,
  getPerpTokenSelectorDynamicTabItems,
  getPerpTokenSelectorFallbackTabId,
  getNextPerpTokenSelectorActiveTabConfig,
  getNextPerpTokenSelectorSortConfig,
  getPerpTokenSelectorPrimaryTabId,
  getPerpTokenSelectorSortAssetCtxsByDex,
  isPerpTokenSelectorDynamicTabUserSort,
  isPerpTokenSelectorAllTab,
  isPerpTokenSelectorFavoritesTab,
  isPerpTokenSelectorPerpsTab,
  isPerpTokenSelectorPrimaryTab,
  isPerpTokenSelectorSortFieldActive,
  isPerpTokenSelectorSpotTab,
  shouldRefreshPerpTokenSelectorSortSnapshot,
  sortPerpTokenSelectorItemsByServerOrder,
  sortPerpTokenSelectorItemsBySortValue,
};

export type { IPerpTokenSelectorPrimaryTabId };
