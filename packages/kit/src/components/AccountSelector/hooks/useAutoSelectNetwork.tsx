import { useEffect, useRef, useState } from 'react';

import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  useAccountSelectorSceneInfo,
  useAccountSelectorStorageReadyAtom,
  useSelectedAccount,
} from '../../../states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector/actions';

import { useAccountSelectorAvailableNetworks } from './useAccountSelectorAvailableNetworks';

// The auto-select is the only thing that gives a fresh selection its network.
// A single rejected background call (cold service worker, transient RPC
// failure) used to leave the store without a network for the whole runtime,
// which home renders as "no address" once an account gets selected
// (OK-62137). Retry a few times before giving up.
const AUTO_SELECT_NETWORK_MAX_RETRY = 3;
const AUTO_SELECT_NETWORK_RETRY_DELAY_MS = 1000;

export function useAutoSelectNetwork({ num }: { num: number }) {
  const { selectedAccount } = useSelectedAccount({ num });
  const { networkId } = selectedAccount;
  const [retryNonce, setRetryNonce] = useState(0);
  const retryCountRef = useRef(0);

  const [isReady] = useAccountSelectorStorageReadyAtom();
  const { networkIds, defaultNetworkId } = useAccountSelectorAvailableNetworks({
    num,
  });

  const { sceneName } = useAccountSelectorSceneInfo();

  const actions = useAccountSelectorActions();

  if (sceneName === EAccountSelectorSceneName.discover) {
    // console.log('useAutoSelectNetwork::: sceneName', {
    //   selectedAccount,
    //   sceneName,
    //   sceneUrl,
    //   networkId,
    //   networkIds,
    //   defaultNetworkId,
    //   isReady,
    //   num,
    // });
  }

  // ** auto select first network if no network selected yet
  useEffect(() => {
    if (!isReady) {
      return undefined;
    }
    if (!networkIds || !networkIds.length) {
      return undefined;
    }
    // TODO move below code to actions
    const network = networkIds.find((item) => item === networkId);
    if (!network || !networkId) {
      let usedNetworkId = networkIds[0];
      if (defaultNetworkId) {
        const founded = networkIds.find((item) => item === defaultNetworkId);
        if (founded) {
          usedNetworkId = defaultNetworkId;
        }
      }

      if (
        usedNetworkId &&
        sceneName === EAccountSelectorSceneName.discover &&
        networkUtils.isAllNetwork({ networkId: usedNetworkId })
      ) {
        usedNetworkId = '';
      }

      if (usedNetworkId) {
        if (sceneName === EAccountSelectorSceneName.discover) {
          console.log(
            'useAutoSelectNetwork::: updateSelectedAccountNetwork',
            usedNetworkId,
          );
        }

        let cancelled = false;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        actions.current
          .updateSelectedAccountNetwork({
            num,
            networkId: usedNetworkId,
          })
          .then(() => {
            retryCountRef.current = 0;
          })
          .catch(() => {
            if (
              cancelled ||
              retryCountRef.current >= AUTO_SELECT_NETWORK_MAX_RETRY
            ) {
              return;
            }
            retryCountRef.current += 1;
            retryTimer = setTimeout(() => {
              if (!cancelled) {
                setRetryNonce((nonce) => nonce + 1);
              }
            }, AUTO_SELECT_NETWORK_RETRY_DELAY_MS);
          });
        return () => {
          cancelled = true;
          if (retryTimer) {
            clearTimeout(retryTimer);
          }
        };
      }
    }
    return undefined;
  }, [
    actions,
    defaultNetworkId,
    isReady,
    networkId,
    networkIds,
    num,
    retryNonce,
    sceneName,
  ]);

  // TODO UI unmount & mount unexpectedly, cause hooks rerun
  // TODO useUpdateEffect()
  // useEffect(() => {
  //   if (!isReady) {
  //     return;
  //   }
  //   void actions.current.autoSelectNetworkOfOthersWalletAccount({
  //     num,
  //     othersWalletAccountId,
  //   });
  // }, [actions, isReady, num, othersWalletAccountId]);

  useDebugComponentRemountLog({ name: `useNetworkAutoSelect:${num}` });
}
