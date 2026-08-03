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
  const { dispatchHomeIntent } = useHomeStoreIntentActions().current;

  return useCallback(
    ({
      actionId,
      execution,
      itemId,
    }: {
      actionId: IHomeBannerActionId;
      execution: 'caller' | 'controller';
      itemId: string;
    }) => {
      if (!facts) {
        return false;
      }
      const intentId = createHomeAuthorityId('intent');
      const intent: IHomeStoreIntent = {
        type: 'headerActionInvoked',
        actionId,
        execution,
        itemId,
        intentId,
        owner: facts.owner,
        sessionId: facts.ownerToken.sessionId,
        authority: {
          kind: 'shellCommands',
          revision: shell.shellCommandRevision,
        },
      };
      const effects = dispatchHomeIntent(intent);
      if (execution === 'controller') {
        return !effects.some((effect) => effect.kind === 'traceReject');
      }
      return effects.some(
        (effect) =>
          effect.kind === 'executeCommand' &&
          effect.intent.intentId === intentId,
      );
    },
    [dispatchHomeIntent, facts, shell.shellCommandRevision],
  );
}
