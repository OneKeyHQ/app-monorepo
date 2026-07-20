import type {
  IHomeContainerSection,
  IHomeContainerTab,
  IHomeContainerTabId,
} from '@onekeyhq/native-components';

import type { IHomeNavigationSemanticModel } from './model/semantic/homeSemanticTypes';

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

export type IHomeWalletCapabilityNavigationModel =
  | {
      status: 'pending';
      shouldCommitTabs: false;
    }
  | {
      status: 'confirmed';
      shouldCommitTabs: true;
      perpsDestination: 'inline' | 'web' | 'unavailable';
      selectedTabId: IHomeContainerTabId;
      tabIds: readonly IHomeContainerTabId[];
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

export function buildHomeWalletCapabilityNavigationModel(
  navigation: IHomeNavigationSemanticModel | undefined,
): IHomeWalletCapabilityNavigationModel {
  if (
    navigation?.kind !== 'ready' ||
    !navigation.destinations ||
    !navigation.perpsDestination ||
    !navigation.sections
  ) {
    return { status: 'pending', shouldCommitTabs: false };
  }
  return {
    status: 'confirmed',
    shouldCommitTabs: true,
    perpsDestination: navigation.perpsDestination,
    selectedTabId: navigation.selectedTabId,
    tabIds: navigation.tabs,
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
  const firstInlineTabId = tabShells.find(
    (tab) => tab.destination === 'inline',
  )?.id;
  const selectedTabIsInline = tabShells.some(
    (tab) => tab.id === selectedTabId && tab.destination === 'inline',
  );
  const nextSelectedTabId =
    shouldCommitTabs && selectedTabId && selectedTabIsInline
      ? selectedTabId
      : (firstInlineTabId ?? 'portfolio');

  return {
    selectedTabId: nextSelectedTabId,
    tabs: tabShells.map((tab) => {
      let sections =
        tab.destination === 'inline' ? (sectionsByTab[tab.id] ?? []) : [];
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
