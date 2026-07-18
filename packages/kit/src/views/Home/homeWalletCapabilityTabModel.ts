import type {
  IHomeContainerSection,
  IHomeContainerTab,
  IHomeContainerTabId,
} from '@onekeyhq/native-components';

export type IHomeWalletCapabilityTabModel =
  | {
      status: 'pending';
      shouldCommitTabs: false;
      isDeFiVisible: false;
      isPerpsVisible: false;
    }
  | {
      status: 'confirmed';
      shouldCommitTabs: true;
      isDeFiVisible: boolean;
      isPerpsVisible: boolean;
    };

export function buildHomeWalletCapabilityTabModel({
  isReady,
  isDeFiSupported,
  isPerpsSupported,
}: {
  isReady: boolean;
  isDeFiSupported: boolean;
  isPerpsSupported: boolean;
}): IHomeWalletCapabilityTabModel {
  if (!isReady) {
    return {
      status: 'pending',
      shouldCommitTabs: false,
      isDeFiVisible: false,
      isPerpsVisible: false,
    };
  }

  return {
    status: 'confirmed',
    shouldCommitTabs: true,
    isDeFiVisible: isDeFiSupported,
    isPerpsVisible: isPerpsSupported,
  };
}

export function resolveHomeWalletSelectedTab<T extends string>({
  selectedTabId,
  visibleTabIds,
  fallbackTabId,
}: {
  selectedTabId: T | undefined;
  visibleTabIds: readonly T[];
  fallbackTabId: T | undefined;
}): T | undefined {
  if (selectedTabId && visibleTabIds.includes(selectedTabId)) {
    return selectedTabId;
  }
  return fallbackTabId;
}

export const HOME_WALLET_CAPABILITY_PENDING_SECTIONS: IHomeContainerSection[] =
  [
    {
      id: 'capability-pending',
      items: [
        {
          id: 'capability-pending-loading',
          renderer: 'loading',
          title: '',
          displayHeight: 240,
        },
      ],
    },
  ];

export function buildHomeWalletAtomicTabState({
  tabShells,
  sectionsByTab,
  shouldCommitTabs,
  selectedTabId,
}: {
  tabShells: IHomeContainerTab[];
  sectionsByTab: Partial<Record<IHomeContainerTabId, IHomeContainerSection[]>>;
  shouldCommitTabs: boolean;
  selectedTabId: IHomeContainerTabId | undefined;
}): {
  tabs: IHomeContainerTab[];
  selectedTabId: IHomeContainerTabId;
} {
  const fallbackTabId = tabShells[0]?.id ?? 'portfolio';
  const nextSelectedTabId = shouldCommitTabs
    ? resolveHomeWalletSelectedTab({
        selectedTabId,
        visibleTabIds: tabShells.map((tab) => tab.id),
        fallbackTabId,
      })
    : 'portfolio';

  return {
    selectedTabId: nextSelectedTabId ?? fallbackTabId,
    tabs: tabShells.map((tab) => {
      let sections = sectionsByTab[tab.id] ?? [];
      if (!shouldCommitTabs) {
        sections =
          tab.id === 'portfolio' ? HOME_WALLET_CAPABILITY_PENDING_SECTIONS : [];
      }
      return { ...tab, sections };
    }),
  };
}

export interface IHomeWalletScopedWorthResult {
  scopeKey: string;
  value: string | undefined;
}

export function resolveHomeWalletScopedWorth({
  result,
  scopeKey,
}: {
  result: IHomeWalletScopedWorthResult | undefined;
  scopeKey: string;
}): string | undefined {
  return result && typeof result === 'object' && result.scopeKey === scopeKey
    ? result.value
    : undefined;
}

export function commitHomeWalletScopedWorth({
  result,
  scopeKey,
  current,
}: {
  result: IHomeWalletScopedWorthResult | undefined;
  scopeKey: string;
  current: IHomeWalletScopedWorthResult | undefined;
}): IHomeWalletScopedWorthResult | undefined {
  if (
    result &&
    typeof result === 'object' &&
    result.scopeKey === scopeKey &&
    result.value !== undefined &&
    scopeKey
  ) {
    return result;
  }
  return current;
}
