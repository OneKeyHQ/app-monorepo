import { useCallback, useEffect, useRef } from 'react';

import { useIsFocused } from '@react-navigation/native';

import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import {
  useAccountSelectorSceneInfo,
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { replaceUrlAccountLandingRoute } from './urlAccountUtils';

export function UrlAccountAutoReplaceHistory({ num }: { num: number }) {
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;
  const { activeAccount } = useActiveAccount({ num });
  const { selectedAccount } = useSelectedAccount({ num });
  const { sceneName } = useAccountSelectorSceneInfo();
  const address = activeAccount?.account?.address;
  const networkId = activeAccount?.network?.id;
  const networkCode = activeAccount?.network?.code;
  const selectedAccountId = `${selectedAccount?.walletId || ''}-${
    selectedAccount?.indexedAccountId || ''
  }-${selectedAccount?.othersWalletAccountId || ''}`;
  const selectedAccountIdPrev = usePrevious(selectedAccountId);
  const shouldReplaceUrlInDelay = useRef(true);
  if (selectedAccountIdPrev !== selectedAccountId) {
    shouldReplaceUrlInDelay.current = false;
  }

  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const replaceUrl = useCallback(
    ({ delay }: { delay: number }) => {
      // use current Tab instead of sceneName, as swap also update home scene
      if (
        sceneName === EAccountSelectorSceneName.homeUrlAccount &&
        platformEnv.isWeb &&
        isFocusedRef.current
      ) {
        timerRef.current = setTimeout(() => {
          replaceUrlAccountLandingRoute({ networkId, networkCode, address });
        }, delay);
      }
    },
    [address, networkId, networkCode, sceneName],
  );

  useEffect(() => {
    replaceUrl({ delay: 0 });
    shouldReplaceUrlInDelay.current = true;
  }, [replaceUrl]);

  // open accountSelector, then close
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isFocused) {
      if (shouldReplaceUrlInDelay.current) {
        replaceUrl({ delay: 100 });
      } else {
        timer = setTimeout(() => {
          shouldReplaceUrlInDelay.current = true;
        }, 1000);
      }
    }
    return () => {
      clearTimeout(timer);
    };
  }, [isFocused, replaceUrl]);

  return null;
}
