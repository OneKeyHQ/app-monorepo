import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useHomeFacts,
  useHomeSection,
  useHomeStoreIntentActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { createHomeAuthorityId } from '../core/homeIdentity';

import {
  executeHomePerpsOpenAsset,
  prepareHomePerpsAccount,
} from './homePerpsActionExecutor';

import type {
  IHomePerpsInfoPanelTab,
  IHomePerpsTradeMode,
} from './homePerpsActionExecutor';
import type { IHomeStoreIntent } from '../store/homeStoreTypes';

const HOME_PERPS_ACTION_IDS = {
  deposit: 'home.perps.deposit',
  openAsset: 'home.perps.openAsset',
} as const;

export function useHomePerpsIntents() {
  const facts = useHomeFacts();
  const section = useHomeSection('perps');
  const { dispatchHomeIntent } = useHomeStoreIntentActions().current;
  const navigation = useAppNavigation();
  const {
    activeAccount: { account, indexedAccount, wallet },
  } = useActiveAccount({ num: 0 });

  const dispatchPerpsAction = useCallback(
    ({ actionId, itemId }: { actionId: string; itemId?: string }) => {
      if (!facts) {
        return false;
      }
      const intentId = createHomeAuthorityId('intent');
      const effects = dispatchHomeIntent({
        type: 'sectionActionInvoked',
        actionId,
        authority: {
          kind: 'sectionCommands',
          revision: section.sectionCommandRevision,
          sectionId: 'perps',
        },
        execution: 'caller',
        intentId,
        itemId,
        owner: facts.owner,
        sectionId: 'perps',
        sessionId: facts.ownerToken.sessionId,
      } satisfies IHomeStoreIntent);
      return effects.some(
        (effect) =>
          effect.kind === 'executeCommand' &&
          effect.intent.intentId === intentId,
      );
    },
    [dispatchHomeIntent, facts, section.sectionCommandRevision],
  );

  const prepareDispatchedHomePerpsAccount = useCallback(
    ({ actionId, itemId }: { actionId: string; itemId?: string }) => {
      if (
        (!account?.id && !indexedAccount?.id) ||
        !dispatchPerpsAction({ actionId, itemId })
      ) {
        return undefined;
      }
      return prepareHomePerpsAccount({
        accountIdentity: {
          accountId: account?.id,
          indexedAccountId: indexedAccount?.id,
          walletId: wallet?.id,
        },
      });
    },
    [account?.id, dispatchPerpsAction, indexedAccount?.id, wallet?.id],
  );

  const openPerpAsset = useCallback(
    (
      coin?: string,
      mode: IHomePerpsTradeMode = 'perp',
      openMarket = true,
      infoPanelTab?: IHomePerpsInfoPanelTab,
    ) => {
      if (
        (!account?.id && !indexedAccount?.id) ||
        !dispatchPerpsAction({
          actionId: HOME_PERPS_ACTION_IDS.openAsset,
          itemId: coin,
        })
      ) {
        return;
      }
      void executeHomePerpsOpenAsset({
        accountIdentity: {
          accountId: account?.id,
          indexedAccountId: indexedAccount?.id,
          walletId: wallet?.id,
        },
        coin,
        infoPanelTab,
        mode,
        openMarket,
        switchToPerps: () => navigation.switchTab(ETabRoutes.Perp),
      });
    },
    [
      account?.id,
      dispatchPerpsAction,
      indexedAccount?.id,
      navigation,
      wallet?.id,
    ],
  );

  const prepareDeposit = useCallback(
    () =>
      prepareDispatchedHomePerpsAccount({
        actionId: HOME_PERPS_ACTION_IDS.deposit,
      }),
    [prepareDispatchedHomePerpsAccount],
  );

  return { openPerpAsset, prepareDeposit };
}

export { HOME_PERPS_ACTION_IDS };
