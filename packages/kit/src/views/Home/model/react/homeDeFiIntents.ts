import { useCallback } from 'react';

import type { IProtocolPositionActionSuccessParams } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionActionDialog';
import {
  useHomeFacts,
  useHomeSection,
  useHomeStoreIntentActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import type { IHomeRuntimeJsonValue } from '@onekeyhq/shared/src/types/homeRuntime';

import { createHomeAuthorityId } from '../core/homeIdentity';
import { normalizeHomeStoreJson } from '../store/homeStoreJson';

import type { IHomeStoreIntent } from '../store/homeStoreTypes';

const HOME_DEFI_ACTION_IDS = {
  positionActionSucceeded: 'home.defi.positionActionSucceeded',
  refresh: 'home.defi.refresh',
} as const;

function useHomeDeFiIntents() {
  const facts = useHomeFacts();
  const section = useHomeSection('defi');
  const { dispatchHomeIntent } = useHomeStoreIntentActions().current;

  const dispatchControllerIntent = useCallback(
    ({
      actionId,
      commandPayload,
      type,
    }: {
      actionId: string;
      commandPayload?: IHomeRuntimeJsonValue;
      type: 'sectionActionInvoked' | 'sectionRefreshRequested';
    }) => {
      if (!facts) {
        return false;
      }
      const receipt = dispatchHomeIntent({
        type,
        actionId,
        ...(commandPayload === undefined ? {} : { commandPayload }),
        authority: {
          kind: 'sectionCommands',
          revision: section.sectionCommandRevision,
          sectionId: 'defi',
        },
        intentId: createHomeAuthorityId('intent'),
        owner: facts.owner,
        sectionId: 'defi',
        sessionId: facts.ownerToken.sessionId,
      } as IHomeStoreIntent);
      return receipt.accepted;
    },
    [dispatchHomeIntent, facts, section.sectionCommandRevision],
  );

  const refresh = useCallback(() => {
    return dispatchControllerIntent({
      type: 'sectionRefreshRequested',
      actionId: HOME_DEFI_ACTION_IDS.refresh,
    });
  }, [dispatchControllerIntent]);

  const onPositionActionSucceeded = useCallback(
    async (payload: IProtocolPositionActionSuccessParams) => {
      const commandPayload = normalizeHomeStoreJson(payload);
      if (commandPayload === undefined) {
        return;
      }
      dispatchControllerIntent({
        type: 'sectionActionInvoked',
        actionId: HOME_DEFI_ACTION_IDS.positionActionSucceeded,
        commandPayload,
      });
    },
    [dispatchControllerIntent],
  );

  return { onPositionActionSucceeded, refresh };
}

export { HOME_DEFI_ACTION_IDS, useHomeDeFiIntents };
