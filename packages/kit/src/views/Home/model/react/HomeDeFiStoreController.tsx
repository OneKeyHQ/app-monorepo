import { useEffect, useRef } from 'react';

import type { IProtocolPositionActionSuccessParams } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionActionDialog';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useHomeInteraction } from '@onekeyhq/kit/src/states/jotai/contexts/home';

import {
  EHomeBackgroundRecoveryRefreshDomain,
  useRegisterHomeBackgroundRecoveryRefresh,
} from '../../pages/HomeBackgroundRecoveryRefreshProvider';

import {
  HOME_DEFI_ACTION_IDS,
  dispatchHomeDeFiSourceCommand,
} from './homeDeFiIntents';
import {
  useHomeNavigationSnapshot,
  useStableHomeFactsOwner,
} from './homeStoreHooks';
import { useHomeDeFiStoreSource } from './useHomeDeFiStoreSource';
import { useHomeStoreControllerActions } from './useHomeStoreControllerActions';

function readPositionActionPayload(
  value: unknown,
): IProtocolPositionActionSuccessParams | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Partial<IProtocolPositionActionSuccessParams>;
  return typeof candidate.accountId === 'string' &&
    typeof candidate.networkId === 'string' &&
    Array.isArray(candidate.data)
    ? (candidate as IProtocolPositionActionSuccessParams)
    : undefined;
}

export function HomeDeFiStoreController() {
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const navigation = useHomeNavigationSnapshot();
  const stableOwner = useStableHomeFactsOwner();
  const interaction = useHomeInteraction();
  const { markHomeSectionCommandHandled } = useHomeStoreControllerActions();
  const processingCommandIdsRef = useRef(new Set<string>());
  const enabled =
    navigation.value.kind === 'ready' && navigation.value.tabs.includes('defi');
  const fetchActive =
    navigation.value.kind === 'ready' &&
    navigation.value.selectedTabId === 'defi';
  const source = useHomeDeFiStoreSource({
    enabled,
    refreshCacheOnly: false,
    visible: fetchActive,
  });
  const refresh = source.refresh;

  useEffect(() => {
    const commands = interaction.pendingSectionCommands.filter(
      (command) => command.sectionId === 'defi',
    );
    for (const command of commands) {
      if (!processingCommandIdsRef.current.has(command.intentId)) {
        processingCommandIdsRef.current.add(command.intentId);
        const execute = async () => {
          try {
            if (command.actionId === HOME_DEFI_ACTION_IDS.refresh) {
              await refresh();
            } else if (
              command.actionId === HOME_DEFI_ACTION_IDS.positionActionSucceeded
            ) {
              const payload = readPositionActionPayload(command.commandPayload);
              if (payload) {
                await dispatchHomeDeFiSourceCommand({
                  type: 'positionActionSucceeded',
                  payload,
                });
              }
            }
          } finally {
            processingCommandIdsRef.current.delete(command.intentId);
            if (stableOwner?.ownerToken.sessionId === command.sessionId) {
              markHomeSectionCommandHandled({
                intentId: command.intentId,
                ownerToken: stableOwner.ownerToken,
              });
            }
          }
        };
        void execute();
      }
    }
  }, [
    interaction.pendingSectionCommands,
    markHomeSectionCommandHandled,
    refresh,
    stableOwner,
  ]);

  useRegisterHomeBackgroundRecoveryRefresh({
    callback: refresh,
    domain: EHomeBackgroundRecoveryRefreshDomain.defi,
    enabled,
    operationKey: 'home-defi-store-source',
    owner: {
      accountId: account?.id,
      networkId: network?.id,
      walletId: wallet?.id,
    },
  });

  return null;
}
