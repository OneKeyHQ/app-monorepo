import type { IPerpDynamicTab } from '@onekeyhq/kit-bg/src/services/ServiceWebviewPerp/ServiceWebviewPerp';
import type { IPerpTokenSortDirection } from '@onekeyhq/shared/types/hyperliquid';

type IFixedTabNames = Record<'favorites' | 'all' | 'perps' | 'spot', string>;
type ITokenSelectorSortValue = string | number | null | undefined;

const FIXED_TAB_IDS = ['favorites', 'all', 'perps', 'spot'] as const;
const ALL_TAB_IDS = new Set(['all']);
const PERPS_TAB_IDS = new Set(['perps']);

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

function buildFixedTabs(fixedTabNames: IFixedTabNames): IPerpDynamicTab[] {
  return FIXED_TAB_IDS.map((tabId) => ({
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
  const fixedTabs = buildFixedTabs(fixedTabNames);
  const normalizedServerTabs = normalizeServerTabs(serverTabs);
  const fixedTabIdSet = new Set(fixedTabs.map((tab) => tab.tabId));
  const serverCategoryTabs = normalizedServerTabs.filter(
    (tab) => !fixedTabIdSet.has(tab.tabId),
  );
  return [...fixedTabs, ...serverCategoryTabs];
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
    tabs.find((tab) => isPerpTokenSelectorAllTab(tab.tabId))?.tabId ??
    tabs[0]?.tabId ??
    'all'
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

export {
  buildPerpTokenSelectorTabs,
  comparePerpTokenSelectorSortValues,
  getPerpTokenSelectorFallbackTabId,
  isPerpTokenSelectorAllTab,
  isPerpTokenSelectorFavoritesTab,
  isPerpTokenSelectorPerpsTab,
  isPerpTokenSelectorSpotTab,
  sortPerpTokenSelectorItemsBySortValue,
};
