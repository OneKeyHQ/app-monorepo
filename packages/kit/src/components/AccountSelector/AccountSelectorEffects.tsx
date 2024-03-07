import { memo, useCallback, useEffect, useRef } from 'react';

import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { useSwapToAnotherAccountSwitchOnAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  useAccountSelectorContextDataAtom,
  useAccountSelectorSceneInfo,
  useAccountSelectorStorageReadyAtom,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '../../states/jotai/contexts/accountSelector/actions';

import { useAutoSelectAccount } from './hooks/useAutoSelectAccount';
import { useAutoSelectDeriveType } from './hooks/useAutoSelectDeriveType';
import { useAutoSelectNetwork } from './hooks/useAutoSelectNetwork';

function AccountSelectorEffectsCmp({ num }: { num: number }) {
  const actions = useAccountSelectorActions();
  const { selectedAccount, isSelectedAccountDefaultValue } = useSelectedAccount(
    { num },
  );
  const [, setContextData] = useAccountSelectorContextDataAtom();
  const [swapToAnotherAccount] = useSwapToAnotherAccountSwitchOnAtom();

  const [isReady] = useAccountSelectorStorageReadyAtom();
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();

  useEffect(() => {
    setContextData({
      sceneName,
      sceneUrl,
    });
  }, [sceneName, sceneUrl, setContextData]);

  const sceneNameRef = useRef(sceneName);
  sceneNameRef.current = sceneName;
  const sceneUrlRef = useRef(sceneUrl);
  sceneUrlRef.current = sceneUrl;

  useAutoSelectAccount({ num });
  useAutoSelectNetwork({ num });
  useAutoSelectDeriveType({ num });

  const reloadActiveAccountInfo = useCallback(async () => {
    if (!isReady) {
      return;
    }
    const activeAccount = await actions.current.reloadActiveAccountInfo({
      num,
      selectedAccount,
    });
    if (activeAccount.account && activeAccount.network?.id) {
      void backgroundApiProxy.serviceAccount.saveAccountAddresses({
        account: activeAccount.account,
        networkId: activeAccount.network?.id,
      });
    }
  }, [actions, isReady, num, selectedAccount]);

  useEffect(() => {
    void (async () => {
      // do not save initial value to storage
      if (!isSelectedAccountDefaultValue) {
        // check initFromStorage() at AccountSelectorStorageInit
        await actions.current.saveToStorage({
          selectedAccount,
          sceneName,
          sceneUrl,
          num,
        });
      } else {
        console.log(
          'AccountSelector saveToStorage skip:  isSelectedAccountDefaultValue',
        );
      }
    })();
  }, [
    actions,
    isSelectedAccountDefaultValue,
    num,
    sceneName,
    sceneUrl,
    selectedAccount,
  ]);

  useEffect(() => {
    void reloadActiveAccountInfo();
  }, [reloadActiveAccountInfo]);

  useEffect(() => {
    const fn = reloadActiveAccountInfo;
    const updateNetwork = (params: {
      networkId: string;
      sceneName: string;
      sceneUrl: string;
      num: number;
    }) => {
      if (
        params.sceneName === sceneNameRef.current &&
        params.sceneUrl === sceneUrlRef.current
      ) {
        void actions.current.updateSelectedAccountNetwork({
          num: params.num,
          networkId: params.networkId,
        });
      }
    };
    // const fn = () => null;
    appEventBus.on(EAppEventBusNames.AccountUpdate, fn);
    appEventBus.on(EAppEventBusNames.WalletUpdate, reloadActiveAccountInfo);
    appEventBus.on(EAppEventBusNames.DAppNetworkUpdate, updateNetwork);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountUpdate, fn);
      appEventBus.off(EAppEventBusNames.WalletUpdate, reloadActiveAccountInfo);
      appEventBus.off(EAppEventBusNames.DAppNetworkUpdate, updateNetwork);
    };
  }, [reloadActiveAccountInfo, actions]);

  const syncHomeAndSwap = useCallback(
    (eventPayload: {
      selectedAccount: IAccountSelectorSelectedAccount;
      sceneName: EAccountSelectorSceneName;
      sceneUrl?: string | undefined;
      num: number;
    }) =>
      actions.current.syncHomeAndSwapSelectedAccount({
        eventPayload,
        sceneName,
        sceneUrl,
        num,
      }),
    [actions, num, sceneName, sceneUrl],
  );
  useEffect(() => {
    appEventBus.on(
      EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
      syncHomeAndSwap,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
        syncHomeAndSwap,
      );
    };
  }, [syncHomeAndSwap]);

  useEffect(() => {
    void (async () => {
      if (
        !swapToAnotherAccount &&
        sceneName === EAccountSelectorSceneName.swap &&
        num === 1
      ) {
        await actions.current.reloadSwapToAccountFromHome();
      }
    })();
  }, [actions, num, sceneName, swapToAnotherAccount]);

  return null;
}

export const AccountSelectorEffects = memo(AccountSelectorEffectsCmp);
