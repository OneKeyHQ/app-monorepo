import { useEffect, useRef } from 'react';

import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useHomeFacts,
  useHomeInteraction,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';

import {
  EHomeBackgroundRecoveryRefreshDomain,
  useRegisterHomeBackgroundRecoveryRefresh,
} from '../../pages/HomeBackgroundRecoveryRefreshProvider';

import { useHomeNavigationSnapshot } from './homeStoreHooks';
import { useHomeNFTStoreSource } from './useHomeNFTStoreSource';
import { useHomeStoreControllerActions } from './useHomeStoreControllerActions';

export function HomeNFTStoreController() {
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const navigation = useHomeNavigationSnapshot();
  const facts = useHomeFacts();
  const interaction = useHomeInteraction();
  const { markHomeSectionCommandHandled } = useHomeStoreControllerActions();
  const processingCommandIdsRef = useRef(new Set<string>());
  const enabled =
    navigation.value.kind === 'ready' && navigation.value.tabs.includes('nft');
  const { refresh } = useHomeNFTStoreSource({
    enabled,
    visible: enabled,
  });

  useEffect(() => {
    const command = interaction.pendingSectionCommands.find(
      (candidate) =>
        candidate.sectionId === 'nft' &&
        candidate.type === 'sectionRefreshRequested' &&
        candidate.actionId === 'home.nft.refresh' &&
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
    domain: EHomeBackgroundRecoveryRefreshDomain.nft,
    enabled,
    operationKey: 'home-nft-store-source',
    owner: {
      accountId: account?.id,
      networkId: network?.id,
      walletId: wallet?.id,
    },
  });

  return null;
}
