import { useCallback } from 'react';

import { rootNavigationRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useHomeFacts,
  useHomeSection,
  useHomeStoreIntentActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import {
  perpsPendingInfoPanelTabAtom,
  spotActiveAssetAtom,
  tradingModeAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import { createHomeAuthorityId } from '../core/homeIdentity';

import type { IHomeStoreIntent } from '../store/homeStoreTypes';

const HOME_PERPS_ACTION_IDS = {
  deposit: 'home.perps.deposit',
  openAsset: 'home.perps.openAsset',
} as const;

type IPerpsTradeMode = 'perp' | 'spot';
type IPerpsInfoPanelTab = 'Positions' | 'Balances';

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

  const ensureHomePerpsAccount = useCallback(
    async ({ actionId, itemId }: { actionId: string; itemId?: string }) => {
      if (
        (!account?.id && !indexedAccount?.id) ||
        !dispatchPerpsAction({ actionId, itemId })
      ) {
        return undefined;
      }
      const deriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: PERPS_NETWORK_ID,
        });
      return backgroundApiProxy.serviceHyperliquid.changeActivePerpsAccount({
        indexedAccountId: indexedAccount?.id ?? null,
        accountId: account?.id ?? null,
        walletId: wallet?.id ?? null,
        deriveType: deriveType ?? 'default',
      });
    },
    [account?.id, dispatchPerpsAction, indexedAccount?.id, wallet?.id],
  );

  const openPerpAsset = useCallback(
    (
      coin?: string,
      mode: IPerpsTradeMode = 'perp',
      openMarket = true,
      infoPanelTab?: IPerpsInfoPanelTab,
    ) => {
      void (async () => {
        const activePerpsAccount = await ensureHomePerpsAccount({
          actionId: HOME_PERPS_ACTION_IDS.openAsset,
          itemId: coin,
        });
        if (
          !activePerpsAccount ||
          (coin && !activePerpsAccount.accountAddress)
        ) {
          return;
        }
        try {
          if (coin && mode === 'perp') {
            await backgroundApiProxy.serviceHyperliquid.changeActiveAsset({
              coin,
            });
            await tradingModeAtom.set('perp');
          } else if (coin && mode === 'spot') {
            await spotActiveAssetAtom.set({
              coin,
              assetId: undefined,
              universe: undefined,
            });
            await tradingModeAtom.set('spot');
          }
        } catch {
          return;
        }
        if (infoPanelTab) {
          await perpsPendingInfoPanelTabAtom.set(infoPanelTab);
        }
        navigation.switchTab(ETabRoutes.Perp);
        if (!coin) {
          return;
        }
        try {
          appEventBus.emit(EAppEventBusNames.PerpSwitchActiveInstrument, {
            mode,
            coin,
          });
          if (infoPanelTab) {
            setTimeout(() => {
              appEventBus.emit(EAppEventBusNames.PerpSwitchInfoPanelTab, {
                tab: infoPanelTab,
              });
            }, 0);
          }
        } catch {
          return;
        }
        if (platformEnv.isNative && openMarket) {
          setTimeout(() => {
            rootNavigationRef.current?.navigate(ERootRoutes.Main, {
              screen: ETabRoutes.Perp,
              params: { screen: EModalPerpRoutes.MobilePerpMarket },
            });
          }, 500);
        }
      })();
    },
    [ensureHomePerpsAccount, navigation],
  );

  const prepareDeposit = useCallback(
    () => ensureHomePerpsAccount({ actionId: HOME_PERPS_ACTION_IDS.deposit }),
    [ensureHomePerpsAccount],
  );

  return { openPerpAsset, prepareDeposit };
}

export { HOME_PERPS_ACTION_IDS };
