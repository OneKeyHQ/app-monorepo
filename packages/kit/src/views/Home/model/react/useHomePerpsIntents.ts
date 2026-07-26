import { useCallback } from 'react';

import {
  useHomeFacts,
  useHomeSection,
  useHomeStoreIntentActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import type { IHomeRuntimeJsonValue } from '@onekeyhq/shared/src/types/homeRuntime';

import { createHomeAuthorityId } from '../core/homeIdentity';

import type {
  IHomePerpsInfoPanelTab,
  IHomePerpsTradeMode,
  prepareHomePerpsAccount,
} from './homePerpsActionExecutor';
import type { IHomeStoreIntent } from '../store/homeStoreTypes';

const HOME_PERPS_ACTION_IDS = {
  deposit: 'home.perps.deposit',
  openAsset: 'home.perps.openAsset',
  prepareDeposit: 'home.perps.prepareDeposit',
} as const;

export function useHomePerpsIntents() {
  const facts = useHomeFacts();
  const section = useHomeSection('perps');
  const { executeHomeCommand } = useHomeStoreIntentActions().current;

  const dispatchPerpsAction = useCallback(
    ({
      actionId,
      commandPayload,
      itemId,
    }: {
      actionId: string;
      commandPayload?: IHomeRuntimeJsonValue;
      itemId?: string;
    }) => {
      if (!facts) {
        return undefined;
      }
      const intentId = createHomeAuthorityId('intent');
      return {
        type: 'sectionActionInvoked',
        actionId,
        authority: {
          kind: 'sectionCommands',
          revision: section.sectionCommandRevision,
          sectionId: 'perps',
        },
        intentId,
        commandPayload,
        itemId,
        owner: facts.owner,
        sectionId: 'perps',
        sessionId: facts.ownerToken.sessionId,
      } satisfies IHomeStoreIntent;
    },
    [facts, section.sectionCommandRevision],
  );

  const openPerpAsset = useCallback(
    (
      coin?: string,
      mode: IHomePerpsTradeMode = 'perp',
      openMarket = true,
      infoPanelTab?: IHomePerpsInfoPanelTab,
    ) => {
      const intent = dispatchPerpsAction({
        actionId: HOME_PERPS_ACTION_IDS.openAsset,
        itemId: coin,
        commandPayload: {
          coin: coin ?? null,
          infoPanelTab: infoPanelTab ?? null,
          mode,
          openMarket,
        },
      });
      if (!intent) {
        return;
      }
      void executeHomeCommand<boolean>(intent).completion;
    },
    [dispatchPerpsAction, executeHomeCommand],
  );

  const prepareDeposit = useCallback(async () => {
    const intent = dispatchPerpsAction({
      actionId: HOME_PERPS_ACTION_IDS.prepareDeposit,
    });
    if (!intent) {
      return undefined;
    }
    const completion =
      await executeHomeCommand<
        Awaited<ReturnType<typeof prepareHomePerpsAccount>>
      >(intent).completion;
    return completion.kind === 'completed' ? completion.value : undefined;
  }, [dispatchPerpsAction, executeHomeCommand]);

  return { openPerpAsset, prepareDeposit };
}

export { HOME_PERPS_ACTION_IDS };
