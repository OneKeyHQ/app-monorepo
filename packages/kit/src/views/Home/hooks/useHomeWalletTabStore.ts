import { useCallback, useEffect, useRef } from 'react';

import {
  useHomeFacts,
  useHomeNavigation,
  useHomeStoreIntentActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { createHomeAuthorityId } from '../model/core/homeIdentity';

import type { IHomeTabId } from '../model/semantic/homeSemanticTypes';

export function useHomeWalletTabStore() {
  const facts = useHomeFacts();
  const navigation = useHomeNavigation();
  const { dispatchHomeIntent } = useHomeStoreIntentActions().current;
  const capabilityNavigation = navigation.value;
  const homeTabDecisionKeyRef = useRef<string | null>(null);
  useEffect(() => {
    let networkScope: 'allNetworks' | 'singleNetwork' | 'unknown' = 'unknown';
    if (facts) {
      networkScope =
        facts.owner.network.kind === 'allNetworks'
          ? 'allNetworks'
          : 'singleNetwork';
    }
    let tabs: readonly IHomeTabId[] = [];
    let selectedTab = '';
    let perpsDestination: 'inline' | 'web' | 'unavailable' = 'unavailable';
    if (capabilityNavigation.kind === 'ready') {
      tabs = capabilityNavigation.tabs;
      selectedTab = capabilityNavigation.selectedTabId;
      perpsDestination = capabilityNavigation.perpsDestination ?? 'unavailable';
    }
    const decision = {
      networkScope,
      navigationKind: capabilityNavigation.kind,
      visibleTabs: tabs.join(','),
      selectedTab,
      showPortfolio: tabs.includes('portfolio'),
      showPerps: tabs.includes('perps'),
      showDeFi: tabs.includes('defi'),
      showNFT: tabs.includes('nft'),
      showHistory: tabs.includes('history'),
      perpsDestination,
    } as const;
    const key = stringUtils.stableStringify(decision);
    if (homeTabDecisionKeyRef.current === key) {
      return;
    }
    homeTabDecisionKeyRef.current = key;
    defaultLogger.wallet.homeUi.homeTabDecision(decision);
  }, [capabilityNavigation, facts]);
  const selectCapabilityTab = useCallback(
    (tabId: IHomeTabId) => {
      if (
        !facts ||
        capabilityNavigation.kind !== 'ready' ||
        !capabilityNavigation.tabs.includes(tabId) ||
        (capabilityNavigation.destinations &&
          capabilityNavigation.destinations[tabId] !== 'inline')
      ) {
        return false;
      }
      dispatchHomeIntent({
        type: 'tabSelected',
        intentId: createHomeAuthorityId('intent'),
        owner: facts.owner,
        sessionId: facts.ownerToken.sessionId,
        tabId,
        authority: {
          kind: 'tabApplicability',
          revision: navigation.tabApplicabilityRevision,
        },
      });
      return true;
    },
    [capabilityNavigation, dispatchHomeIntent, facts, navigation],
  );
  const isReady = capabilityNavigation.kind === 'ready';
  return {
    capabilityNavigation,
    isReady,
    isDeFiSupported: isReady && capabilityNavigation.tabs.includes('defi'),
    isPerpsSupported: isReady && capabilityNavigation.tabs.includes('perps'),
    isNFTSupported: isReady && capabilityNavigation.tabs.includes('nft'),
    perpTabShowWeb: isReady && capabilityNavigation.perpsDestination === 'web',
    selectCapabilityTab,
  };
}
