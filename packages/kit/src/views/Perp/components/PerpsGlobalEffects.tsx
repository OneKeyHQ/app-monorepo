import { useCallback, useEffect, useRef } from 'react';

import { noop } from 'lodash';

import { useUpdateEffect } from '@onekeyhq/components';
import {
  useAccountIsAutoCreatingAtom,
  useIndexedAccountAddressCreationStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  perpsSelectedSymbolAtom,
  usePerpsSelectedAccountAtom,
  usePerpsSelectedAccountStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/perps';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IActiveAssetData,
  IBook,
  IWsActiveAssetCtx,
  IWsAllMids,
  IWsWebData2,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { GlobalJotaiReady } from '../../../components/GlobalJotaiReady';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';
import {
  useConnectionStateAtom,
  useCurrentUserAtom,
  useSubscriptionActiveAtom,
} from '../../../states/jotai/contexts/hyperliquid/atoms';

function useHyperliquidEventBusListener() {
  const actions = useHyperliquidActions();

  useEffect(() => {
    const handleDataUpdate = (payload: unknown) => {
      const eventPayload = payload as {
        type: 'market' | 'account';
        subType: string;
        data: any;
        metadata: {
          timestamp: number;
          source: string;
          key?: string;
          coin?: string;
          userId?: string;
          interval?: string;
        };
      };
      const { subType, data } = eventPayload;

      try {
        switch (subType) {
          case ESubscriptionType.ALL_MIDS:
            void actions.current.updateAllMids(data as IWsAllMids);
            break;

          case ESubscriptionType.ACTIVE_ASSET_CTX:
            if (eventPayload.metadata.coin) {
              void actions.current.updateActiveAssetCtx(
                data as IWsActiveAssetCtx,
                eventPayload.metadata.coin,
              );
            }
            break;

          case ESubscriptionType.WEB_DATA2:
            void actions.current.updateWebData2(data as IWsWebData2);
            break;

          case ESubscriptionType.ACTIVE_ASSET_DATA:
            if (eventPayload.metadata.coin) {
              void actions.current.updateActiveAssetData(
                data as IActiveAssetData,
                eventPayload.metadata.coin,
              );
            }
            break;

          case ESubscriptionType.L2_BOOK:
            void actions.current.updateL2Book(data as IBook);
            break;

          case ESubscriptionType.BBO:
            break;

          default:
        }
      } catch (error) {
        console.error('Failed to process data update:', error);
      }
    };

    const handleConnectionChange = (payload: unknown) => {
      const eventPayload = payload as {
        type: 'connection';
        subType: string;
        data: {
          status: 'connected' | 'disconnected';
          lastConnected: number;
          service: string;
          activeSubscriptions: number;
        };
        metadata: {
          timestamp: number;
          source: string;
        };
      };
      const { data } = eventPayload;

      try {
        void actions.current.updateConnectionState({
          isConnected: data.status === 'connected',
        });
      } catch (error) {
        console.error('Failed to process connection change:', error);
      }
    };

    appEventBus.on(EAppEventBusNames.HyperliquidDataUpdate, handleDataUpdate);
    appEventBus.on(
      EAppEventBusNames.HyperliquidConnectionChange,
      handleConnectionChange,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.HyperliquidDataUpdate,
        handleDataUpdate,
      );
      appEventBus.off(
        EAppEventBusNames.HyperliquidConnectionChange,
        handleConnectionChange,
      );
    };
  }, [actions]);
}

function useHyperliquidSession() {
  const [subscriptionActive] = useSubscriptionActiveAtom();
  const [connectionState] = useConnectionStateAtom();
  const actions = useHyperliquidActions();

  const [currentAccount] = usePerpsSelectedAccountAtom();
  useListenTabFocusState(
    ETabRoutes.Perp,
    (isFocus: boolean, isHiddenByModal: boolean) => {
      if (isFocus && !isHiddenByModal) {
        // Handle tab focus
      } else {
        // Handle tab unfocus
      }
    },
  );

  useEffect(() => {
    const actionsRef = actions.current;
    return () => {
      void actionsRef.clearAllData();
    };
  }, [actions]);

  return {
    userAddress: currentAccount?.accountAddress,
    isConnected: connectionState.isConnected,
    isActive: subscriptionActive,
  };
}

function useHyperliquidAccountSelect() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [currentPerpsAccount] = usePerpsSelectedAccountAtom();
  const actions = useHyperliquidActions();
  const isFirstMountRef = useRef(true);
  const [, setCurrentUser] = useCurrentUserAtom();
  const [accountIsAutoCreating] = useAccountIsAutoCreatingAtom();
  const [indexedAccountAddressCreationState] =
    useIndexedAccountAddressCreationStateAtom();

  // const [perpsAccountStatus] = usePerpsSelectedAccountStatusAtom();
  // const perpsAccountStatusRef = useRef(perpsAccountStatus);
  // perpsAccountStatusRef.current = perpsAccountStatus;

  const selectPerpsAccount = useCallback(async () => {
    noop(activeAccount.account?.address);
    const account =
      await backgroundApiProxy.serviceHyperliquid.selectPerpsAccount({
        indexedAccountId: activeAccount?.indexedAccount?.id || null,
        accountId: activeAccount?.account?.id || null,
        deriveType: activeAccount?.deriveType ?? 'default',
      });
    setCurrentUser(account.accountAddress);
    const checkResult =
      await backgroundApiProxy.serviceHyperliquid.checkPerpsAccountStatus();
    console.log('checkPerpsAccountStatus::', checkResult);
  }, [
    activeAccount.account?.address,
    activeAccount?.indexedAccount?.id,
    activeAccount?.account?.id,
    activeAccount?.deriveType,
    setCurrentUser,
  ]);
  const selectPerpsAccountRef = useRef(selectPerpsAccount);
  selectPerpsAccountRef.current = selectPerpsAccount;

  useEffect(() => {
    void selectPerpsAccount();
  }, [selectPerpsAccount]);

  useUpdateEffect(() => {
    if (!accountIsAutoCreating && !indexedAccountAddressCreationState) {
      void selectPerpsAccountRef.current();
    }
  }, [accountIsAutoCreating, indexedAccountAddressCreationState]);

  useEffect(() => {
    noop(currentPerpsAccount?.accountAddress);

    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      if (currentPerpsAccount?.accountAddress) {
        void actions.current.updateSubscriptions();
      }
    } else {
      void actions.current.updateSubscriptions();
    }
  }, [actions, currentPerpsAccount?.accountAddress]);
}

function useHyperliquidSymbolSelect() {
  const actions = useHyperliquidActions();
  useEffect(() => {
    void (async () => {
      await backgroundApiProxy.serviceHyperliquid.refreshTradingUniverse();
      const currentToken = await perpsSelectedSymbolAtom.get();
      await actions.current.setCurrentToken(currentToken.coin);
    })();
  }, [actions]);
}

function PerpsGlobalEffectsView() {
  useHyperliquidEventBusListener();
  useHyperliquidSession();
  useHyperliquidAccountSelect();
  useHyperliquidSymbolSelect();

  return null;
}

export function PerpsGlobalEffects() {
  return (
    <GlobalJotaiReady>
      <PerpsGlobalEffectsView />
    </GlobalJotaiReady>
  );
}
