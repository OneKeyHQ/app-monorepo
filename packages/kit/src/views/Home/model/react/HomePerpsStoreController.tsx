import { useEffect, useRef } from 'react';

import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useHomeFacts,
  useHomeInteraction,
  useHomeNavigation,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';

import {
  EHomeBackgroundRecoveryRefreshDomain,
  useRegisterHomeBackgroundRecoveryRefresh,
} from '../../pages/HomeBackgroundRecoveryRefreshProvider';
import { usePerpsHomePortfolio } from '../../pages/usePerpsHomePortfolio';

import { isHomePerpsSourceActive } from './homePerpsStoreControllerPolicy';
import { useHomeStoreControllerActions } from './useHomeStoreControllerActions';

export function HomePerpsStoreController() {
  const navigation = useHomeNavigation();
  const facts = useHomeFacts();
  const interaction = useHomeInteraction();
  const { markHomeSectionCommandHandled } = useHomeStoreControllerActions();
  const processingCommandIdsRef = useRef(new Set<string>());
  const isSourceApplicable = isHomePerpsSourceActive(navigation.value);
  const fetchActive =
    navigation.value.kind === 'ready' &&
    navigation.value.selectedTabId === 'perps';
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const { refresh } = usePerpsHomePortfolio({
    isSourceActive: isSourceApplicable && fetchActive,
  });

  useEffect(() => {
    const command = interaction.pendingSectionCommands.find(
      (candidate) =>
        candidate.sectionId === 'perps' &&
        candidate.type === 'sectionRefreshRequested' &&
        candidate.actionId === 'home.perps.refresh' &&
        !processingCommandIdsRef.current.has(candidate.intentId),
    );
    if (!command || !facts) {
      return;
    }
    processingCommandIdsRef.current.add(command.intentId);
    const ownerToken = facts.ownerToken;
    void refresh().finally(() => {
      processingCommandIdsRef.current.delete(command.intentId);
      markHomeSectionCommandHandled({
        intentId: command.intentId,
        ownerToken,
      });
    });
  }, [
    facts,
    interaction.pendingSectionCommands,
    markHomeSectionCommandHandled,
    refresh,
  ]);

  useRegisterHomeBackgroundRecoveryRefresh({
    callback: refresh,
    domain: EHomeBackgroundRecoveryRefreshDomain.perps,
    operationKey: 'home-perps-store-source',
    owner: {
      accountId: account?.id,
      networkId: network?.id,
      walletId: wallet?.id,
    },
  });

  return null;
}
