import { useCallback } from 'react';

import {
  useHomeFacts,
  useHomeSection,
  useHomeStoreIntentActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { createHomeAuthorityId } from '../core/homeIdentity';
import { HOME_HISTORY_ACTION_IDS } from '../sections/history/homeHistoryStoreModel';

import type { IHomeStoreIntent } from '../store/homeStoreTypes';

export function useHomeHistoryIntents() {
  const facts = useHomeFacts();
  const historySection = useHomeSection('history');
  const { dispatchHomeIntent, executeHomeCommand } =
    useHomeStoreIntentActions().current;

  const createHistoryIntent = useCallback(
    (
      intent: Omit<
        Extract<
          IHomeStoreIntent,
          { type: 'sectionActionInvoked' | 'sectionRefreshRequested' }
        >,
        'authority' | 'intentId' | 'owner' | 'sectionId' | 'sessionId'
      >,
    ) => {
      if (!facts) {
        return undefined;
      }
      return {
        ...intent,
        authority: {
          kind: 'sectionCommands',
          revision: historySection.sectionCommandRevision,
          sectionId: 'history',
        },
        intentId: createHomeAuthorityId('intent'),
        owner: facts.owner,
        sectionId: 'history',
        sessionId: facts.ownerToken.sessionId,
      } as IHomeStoreIntent;
    },
    [facts, historySection.sectionCommandRevision],
  );

  const refresh = useCallback(() => {
    const intent = createHistoryIntent({
      type: 'sectionRefreshRequested',
      actionId: HOME_HISTORY_ACTION_IDS.refresh,
    });
    return intent ? dispatchHomeIntent(intent).accepted : false;
  }, [createHistoryIntent, dispatchHomeIntent]);

  const loadMore = useCallback(() => {
    const intent = createHistoryIntent({
      type: 'sectionActionInvoked',
      actionId: HOME_HISTORY_ACTION_IDS.loadMore,
    });
    return intent ? dispatchHomeIntent(intent).accepted : false;
  }, [createHistoryIntent, dispatchHomeIntent]);

  const openDetails = useCallback(
    async (history: IAccountHistoryTx) => {
      const intent = createHistoryIntent({
        type: 'sectionActionInvoked',
        actionId: HOME_HISTORY_ACTION_IDS.openDetails,
        itemId: history.id,
      });
      if (!intent) {
        return false;
      }
      const execution = executeHomeCommand<void>(intent);
      const completion = await execution.completion;
      return completion.kind === 'completed';
    },
    [createHistoryIntent, executeHomeCommand],
  );

  return { loadMore, openDetails, refresh };
}
