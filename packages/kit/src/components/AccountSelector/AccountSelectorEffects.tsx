import { memo, useCallback, useEffect, useRef } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  useAccountSelectorSceneInfo,
  useAccountSelectorStorageReadyAtom,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '../../states/jotai/contexts/accountSelector/actions';

import { useAccountAutoSelect } from './hooks/useAccountAutoSelect';
import { useDeriveTypeAutoSelect } from './hooks/useDeriveTypeAutoSelect';
import { useNetworkAutoSelect } from './hooks/useNetworkAutoSelect';

function AccountSelectorEffectsCmp({ num }: { num: number }) {
  // TODO multiple UI sync
  const actions = useAccountSelectorActions();
  const { selectedAccount, isSelectedAccountDefaultValue } = useSelectedAccount(
    { num },
  );

  const [isReady] = useAccountSelectorStorageReadyAtom();
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();

  const sceneNameRef = useRef(sceneName);
  sceneNameRef.current = sceneName;
  const sceneUrlRef = useRef(sceneUrl);
  sceneUrlRef.current = sceneUrl;

  useAccountAutoSelect({ num });
  useNetworkAutoSelect({ num });
  useDeriveTypeAutoSelect({ num });

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
    // do not save initial value to storage
    if (!isSelectedAccountDefaultValue) {
      void actions.current.saveToStorage({
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
  }, [
    actions,
    isReady,
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
        actions.current.updateSelectedAccount({
          num: params.num,
          builder: (v) => ({
            ...v,
            networkId: params.networkId,
          }),
        });
      }
    };
    // const fn = () => null;
    appEventBus.on(EAppEventBusNames.AccountUpdate, fn);
    appEventBus.on(EAppEventBusNames.DAppNetworkUpdate, updateNetwork);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountUpdate, fn);
      appEventBus.off(EAppEventBusNames.DAppNetworkUpdate, updateNetwork);
    };
  }, [reloadActiveAccountInfo, actions]);

  return null;
}

export const AccountSelectorEffects = memo(AccountSelectorEffectsCmp);
