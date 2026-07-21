import { projectHomeCapabilityAuthority } from '../capabilities/homeCapabilityPolicy';
import {
  buildHomeConfirmedCapabilityIdentity,
  getHomeConfirmedCapability,
} from '../capabilities/homeConfirmedCapabilityCache';

import { reduceHomeTabIntent } from './homeTabIntentReducer';

import type { IHomeTabIntentState } from './homeTabIntentReducer';
import type { IHomeCapabilityFacts } from '../capabilities/homeCapabilityTypes';
import type {
  IHomeConfirmedCapabilityCacheCommand,
  IHomeConfirmedCapabilityCacheState,
} from '../capabilities/homeConfirmedCapabilityCache';
import type { IHomeNavigationSemanticModel } from '../semantic/homeSemanticTypes';

type IHomeNavigationProjection = {
  cacheCommand?: IHomeConfirmedCapabilityCacheCommand;
  intent: IHomeTabIntentState;
  navigation: IHomeNavigationSemanticModel;
};

function projectHomeNavigation({
  cache,
  facts,
  intent,
}: {
  cache: IHomeConfirmedCapabilityCacheState;
  facts: IHomeCapabilityFacts;
  intent: IHomeTabIntentState;
}): IHomeNavigationProjection {
  const identity = buildHomeConfirmedCapabilityIdentity(facts);
  const confirmed = getHomeConfirmedCapability(cache, identity);
  const authority = projectHomeCapabilityAuthority({ confirmed, facts });
  if (authority.presentation.kind === 'pending') {
    return { intent, navigation: { kind: 'hidden' } };
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
  let cacheCommand: IHomeConfirmedCapabilityCacheCommand | undefined;
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

export { projectHomeNavigation };
export type { IHomeNavigationProjection };
