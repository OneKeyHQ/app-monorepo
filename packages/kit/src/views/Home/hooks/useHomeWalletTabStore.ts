import { useCallback } from 'react';

import {
  useHomeFacts,
  useHomeNavigation,
  useHomeStoreIntentActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';

import { createHomeAuthorityId } from '../model/core/homeIdentity';

import type { IHomeTabId } from '../model/semantic/homeSemanticTypes';

export function useHomeWalletTabStore() {
  const facts = useHomeFacts();
  const navigation = useHomeNavigation();
  const { dispatchHomeIntent } = useHomeStoreIntentActions().current;
  const capabilityNavigation = navigation.value;
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
