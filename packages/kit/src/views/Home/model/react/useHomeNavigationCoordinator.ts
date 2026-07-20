import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  useHomeActions,
  useHomeConfirmedCapabilityCacheAtom,
  useHomeTabIntentAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { projectHomeCapabilityAuthority } from '../capabilities/homeCapabilityPolicy';
import {
  buildHomeConfirmedCapabilityIdentity,
  getHomeConfirmedCapability,
} from '../capabilities/homeConfirmedCapabilityCache';
import { reduceHomeTabIntent } from '../navigation/homeTabIntentReducer';

import type { IHomeCapabilityFacts } from '../capabilities/homeCapabilityTypes';
import type { IHomeTabIntentState } from '../navigation/homeTabIntentReducer';
import type {
  IHomeNavigationSemanticModel,
  IHomeTabId,
} from '../semantic/homeSemanticTypes';

type IHomeNavigationCoordinatorResult = {
  cacheCommand?: Parameters<
    ReturnType<
      typeof useHomeActions
    >['current']['dispatchConfirmedCapabilityCache']
  >[0];
  intent: IHomeTabIntentState;
  navigation: IHomeNavigationSemanticModel;
};

function resolveHomeNavigationCoordinatorState({
  cache,
  facts,
  intent,
}: {
  cache: Parameters<typeof getHomeConfirmedCapability>[0];
  facts: IHomeCapabilityFacts;
  intent: IHomeTabIntentState;
}): IHomeNavigationCoordinatorResult {
  const identity = buildHomeConfirmedCapabilityIdentity(facts);
  const confirmed = getHomeConfirmedCapability(cache, identity);
  const authority = projectHomeCapabilityAuthority({ confirmed, facts });
  if (authority.presentation.kind === 'pending') {
    return {
      intent,
      navigation: { kind: 'hidden' },
    };
  }
  const presentation = authority.presentation;
  const selectableTabs = presentation.value.tabs.filter(
    (tabId) => presentation.value.destinations[tabId] === 'inline',
  ) as [
    (typeof presentation.value.tabs)[number],
    ...(typeof presentation.value.tabs)[number][],
  ];
  const nextIntent = reduceHomeTabIntent(intent, {
    kind: 'reconcile',
    ownerToken: facts.ownerToken,
    tabs: selectableTabs,
  });
  let cacheCommand: IHomeNavigationCoordinatorResult['cacheCommand'];
  if (authority.cacheCommit) {
    cacheCommand = { kind: 'commit', record: authority.cacheCommit };
  } else if (confirmed) {
    cacheCommand = { identity, kind: 'touch' };
  }
  return {
    cacheCommand,
    intent: nextIntent,
    navigation: {
      kind: 'ready',
      destinations: presentation.value.destinations,
      freshness: presentation.freshness,
      perpsDestination: presentation.value.perpsDestination,
      refresh: presentation.refresh,
      sections: presentation.value.sections,
      selectedTabId: nextIntent.selectedTabId ?? presentation.value.tabs[0],
      tabs: presentation.value.tabs,
    },
  };
}

function useHomeNavigationCoordinator(facts: IHomeCapabilityFacts | undefined) {
  const [cache] = useHomeConfirmedCapabilityCacheAtom();
  const [intent] = useHomeTabIntentAtom();
  const actions = useHomeActions().current;
  const publicationIdentityRef = useRef('');
  const result = useMemo(
    () =>
      facts
        ? resolveHomeNavigationCoordinatorState({ cache, facts, intent })
        : undefined,
    [cache, facts, intent],
  );

  useEffect(() => {
    if (!result || result.intent === intent) {
      return;
    }
    actions.setHomeTabIntent(result.intent);
  }, [actions, intent, result]);

  useEffect(() => {
    if (result?.cacheCommand) {
      actions.dispatchConfirmedCapabilityCache(result.cacheCommand);
    }
  }, [actions, result?.cacheCommand]);

  useEffect(() => {
    if (!facts || !result) {
      return;
    }
    const identity = stringUtils.stableStringify({
      navigation: result.navigation,
      owner: facts.ownerToken,
    });
    if (publicationIdentityRef.current === identity) {
      return;
    }
    publicationIdentityRef.current = identity;
    actions.publishAuthoritativeNavigation({
      owner: facts.ownerToken,
      revision: 0,
      value: result.navigation,
    });
  }, [actions, facts, result]);

  const selectTab = useCallback(
    (tabId: IHomeTabId) => {
      if (!facts || result?.navigation.kind !== 'ready') {
        return false;
      }
      const navigation = result.navigation;
      const selectableTabs = navigation.tabs.filter(
        (candidate) => navigation.destinations?.[candidate] === 'inline',
      ) as [typeof tabId, ...(typeof tabId)[]];
      if (!selectableTabs.includes(tabId)) {
        return false;
      }
      actions.setHomeTabIntent(
        reduceHomeTabIntent(result.intent, {
          kind: 'select',
          ownerToken: facts.ownerToken,
          tabId,
          tabs: selectableTabs,
        }),
      );
      return true;
    },
    [actions, facts, result],
  );

  return { navigation: result?.navigation, selectTab };
}

export { resolveHomeNavigationCoordinatorState, useHomeNavigationCoordinator };
export type { IHomeNavigationCoordinatorResult };
