import { useCallback } from 'react';

import {
  useHomeFacts,
  useHomeShell,
  useHomeStoreIntentActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';

import { createHomeAuthorityId } from '../core/homeIdentity';

import type { IHomeBannerActionId } from '../sections/banner/homeBannerStoreModel';
import type { IHomeStoreIntent } from '../store/homeStoreTypes';

export function useHomeBannerIntents() {
  const facts = useHomeFacts();
  const shell = useHomeShell();
  const { executeHomeCommand } = useHomeStoreIntentActions().current;

  return useCallback(
    ({
      actionId,
      itemId,
    }: {
      actionId: IHomeBannerActionId;
      itemId: string;
    }) => {
      if (!facts) {
        return false;
      }
      const intentId = createHomeAuthorityId('intent');
      const intent: IHomeStoreIntent = {
        type: 'headerActionInvoked',
        actionId,
        itemId,
        intentId,
        owner: facts.owner,
        sessionId: facts.ownerToken.sessionId,
        authority: {
          kind: 'shellCommands',
          revision: shell.shellCommandRevision,
        },
      };
      return executeHomeCommand<void>(intent).receipt.accepted;
    },
    [executeHomeCommand, facts, shell.shellCommandRevision],
  );
}
