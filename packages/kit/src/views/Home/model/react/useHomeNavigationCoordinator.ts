import { useCallback, useEffect } from 'react';

import {
  useHomeFacts,
  useHomeNavigation,
  useHomeStoreIntentActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';

import { createHomeAuthorityId } from '../core/homeIdentity';
import { projectHomeNavigation } from '../navigation/homeNavigationProjector';

import { useHomeStoreSourcePublisher } from './useHomeStoreSourcePublisher';

import type { IHomeCapabilityFacts } from '../capabilities/homeCapabilityTypes';
import type { IHomeTabId } from '../semantic/homeSemanticTypes';

function useHomeNavigationCoordinator(facts: IHomeCapabilityFacts | undefined) {
  const homeFacts = useHomeFacts();
  const navigation = useHomeNavigation();
  const { dispatchHomeIntent } = useHomeStoreIntentActions().current;
  const { publishHomeCapabilitySource } = useHomeStoreSourcePublisher();

  useEffect(() => {
    if (!facts) {
      return;
    }
    publishHomeCapabilitySource({
      facts,
    });
  }, [facts, publishHomeCapabilitySource]);

  const selectTab = useCallback(
    (tabId: IHomeTabId) => {
      if (
        !facts ||
        !homeFacts ||
        homeFacts.ownerToken.scopeKey !== facts.ownerToken.scopeKey ||
        homeFacts.ownerToken.sessionId !== facts.ownerToken.sessionId ||
        navigation.value.kind !== 'ready'
      ) {
        return false;
      }
      const storeNavigation = navigation.value;
      if (
        !storeNavigation.tabs.includes(tabId) ||
        (storeNavigation.destinations &&
          storeNavigation.destinations[tabId] !== 'inline')
      ) {
        return false;
      }
      dispatchHomeIntent({
        type: 'tabSelected',
        authority: {
          kind: 'tabApplicability',
          revision: navigation.tabApplicabilityRevision,
        },
        intentId: createHomeAuthorityId('intent'),
        owner: homeFacts.owner,
        sessionId: facts.ownerToken.sessionId,
        tabId,
      });
      return true;
    },
    [dispatchHomeIntent, facts, homeFacts, navigation],
  );

  return { navigation: navigation.value, selectTab };
}

export { projectHomeNavigation as resolveHomeNavigationCoordinatorState };
export { useHomeNavigationCoordinator };
