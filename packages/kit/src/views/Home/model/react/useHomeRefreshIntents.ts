import { useCallback, useMemo } from 'react';

import {
  useHomeFacts,
  useHomeNavigation,
  useHomeResource,
  useHomeSection,
  useHomeStoreIntentActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import type { IHomeRuntimeJsonValue } from '@onekeyhq/shared/src/types/homeRuntime';

import { createHomeAuthorityId } from '../core/homeIdentity';

import type { IHomeStoreResourceSlot } from '../store/homeStoreTypes';

export type IHomeRefreshSectionId =
  | 'portfolio'
  | 'perps'
  | 'defi'
  | 'nft'
  | 'history';

const HOME_REFRESH_ACTION_IDS: Record<IHomeRefreshSectionId, string> = {
  portfolio: 'home.portfolio.refresh',
  perps: 'home.perps.refresh',
  defi: 'home.defi.refresh',
  nft: 'home.nft.refresh',
  history: 'home.history.refresh',
};

function isResourceRefreshing(
  resource: IHomeStoreResourceSlot<IHomeRuntimeJsonValue>,
): boolean {
  if (resource.kind === 'loading') {
    return true;
  }
  return (
    (resource.kind === 'ready' || resource.kind === 'empty') &&
    resource.refresh === 'refreshing'
  );
}

export function useHomeRefreshIntents() {
  const facts = useHomeFacts();
  const navigation = useHomeNavigation();
  const portfolioSection = useHomeSection('portfolio');
  const perpsSection = useHomeSection('perps');
  const defiSection = useHomeSection('defi');
  const nftSection = useHomeSection('nft');
  const historySection = useHomeSection('history');
  const portfolioResource = useHomeResource('portfolio');
  const perpsResource = useHomeResource('perps');
  const defiResource = useHomeResource('defi');
  const nftResource = useHomeResource('nft');
  const historyResource = useHomeResource('history');
  const { dispatchHomeIntent } = useHomeStoreIntentActions().current;

  const sectionRevisions = useMemo(
    () => ({
      portfolio: portfolioSection.sectionCommandRevision,
      perps: perpsSection.sectionCommandRevision,
      defi: defiSection.sectionCommandRevision,
      nft: nftSection.sectionCommandRevision,
      history: historySection.sectionCommandRevision,
    }),
    [
      defiSection.sectionCommandRevision,
      historySection.sectionCommandRevision,
      nftSection.sectionCommandRevision,
      perpsSection.sectionCommandRevision,
      portfolioSection.sectionCommandRevision,
    ],
  );
  const refreshingBySection = useMemo(
    () => ({
      portfolio: isResourceRefreshing(portfolioResource),
      perps: isResourceRefreshing(perpsResource),
      defi: isResourceRefreshing(defiResource),
      nft: isResourceRefreshing(nftResource),
      history: isResourceRefreshing(historyResource),
    }),
    [
      defiResource,
      historyResource,
      nftResource,
      perpsResource,
      portfolioResource,
    ],
  );

  const refreshSection = useCallback(
    (sectionId: IHomeRefreshSectionId) => {
      if (!facts) {
        return false;
      }
      const effects = dispatchHomeIntent({
        type: 'sectionRefreshRequested',
        actionId: HOME_REFRESH_ACTION_IDS[sectionId],
        authority: {
          kind: 'sectionCommands',
          sectionId,
          revision: sectionRevisions[sectionId],
        },
        execution: 'controller',
        intentId: createHomeAuthorityId('intent'),
        owner: facts.owner,
        sectionId,
        sessionId: facts.ownerToken.sessionId,
      });
      return !effects.some((effect) => effect.kind === 'traceReject');
    },
    [dispatchHomeIntent, facts, sectionRevisions],
  );

  const refreshSelectedSection = useCallback(() => {
    if (navigation.value.kind !== 'ready') {
      return false;
    }
    const sectionId = navigation.value.selectedTabId;
    if (!(sectionId in HOME_REFRESH_ACTION_IDS)) {
      return false;
    }
    return refreshSection(sectionId as IHomeRefreshSectionId);
  }, [navigation.value, refreshSection]);

  const refreshAllSections = useCallback(() => {
    if (navigation.value.kind !== 'ready') {
      return false;
    }
    const sectionTabs = navigation.value.tabs.filter(
      (tabId): tabId is IHomeRefreshSectionId =>
        tabId in HOME_REFRESH_ACTION_IDS,
    );
    return sectionTabs
      .map((sectionId) => refreshSection(sectionId))
      .some(Boolean);
  }, [navigation.value, refreshSection]);

  const selectedSectionRefreshing =
    navigation.value.kind === 'ready' &&
    navigation.value.selectedTabId in refreshingBySection
      ? refreshingBySection[
          navigation.value.selectedTabId as IHomeRefreshSectionId
        ]
      : false;

  return {
    refreshAllSections,
    refreshSection,
    refreshSelectedSection,
    refreshingBySection,
    selectedSectionRefreshing,
  };
}
