import type { IPerpDynamicTab } from '@onekeyhq/kit-bg/src/services/ServiceWebviewPerp/ServiceWebviewPerp';
import type { IPerpTokenSortDirection } from '@onekeyhq/shared/types/hyperliquid';

type IFixedTabNames = Record<'favorites' | 'all' | 'perps' | 'spot', string>;
type ITokenSelectorSortValue = string | number | null | undefined;
type IPerpTokenSelectorPrimaryTabId = 'favorites' | 'perps' | 'spot';
type IPerpTokenSelectorSortSnapshotKey = {
  field?: string;
  direction?: string;
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

function shouldRefreshPerpTokenSelectorSortSnapshot({
  lastSort,
  field,
  direction,
  snapshotEmpty,
}: {
  lastSort: IPerpTokenSelectorSortSnapshotKey | null;
  field?: string;
  direction?: string;
  snapshotEmpty: boolean;
}) {
  return (
    lastSort?.field !== field ||
    lastSort?.direction !== direction ||
    snapshotEmpty
  );
}

export {
  buildPrimaryTabs,
  buildPerpTokenSelectorCategoryTabs,
  buildPerpTokenSelectorTabs,
  comparePerpTokenSelectorSortValues,
  getPerpTokenSelectorFallbackTabId,
  getPerpTokenSelectorPrimaryTabId,
  isPerpTokenSelectorAllTab,
  isPerpTokenSelectorFavoritesTab,
  isPerpTokenSelectorPerpsTab,
  isPerpTokenSelectorPrimaryTab,
  isPerpTokenSelectorSpotTab,
  shouldRefreshPerpTokenSelectorSortSnapshot,
  sortPerpTokenSelectorItemsBySortValue,
};

export type { IPerpTokenSelectorPrimaryTabId };
