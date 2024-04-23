import { useCallback, useEffect, useRef } from 'react';

import { StackActions, useIsFocused } from '@react-navigation/native';

import { Toast } from '@onekeyhq/components';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabHomeRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../components/AccountSelector';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useAppRoute } from '../../hooks/useAppRoute';
import { usePrevious } from '../../hooks/usePrevious';
import {
  useAccountSelectorActions,
  useAccountSelectorSceneInfo,
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';

const localStorageKey = '$onekeyPrevSelectedUrlAccount';
function savePrevUrlAccount({
  address,
  networkId,
}: {
  address: string | undefined;
  networkId: string | undefined;
}) {
  if (!platformEnv.isWeb) {
    return;
  }
  if (address && networkId) {
    localStorage.setItem(
      localStorageKey,
      JSON.stringify({ address, networkId }),
    );
  } else {
    localStorage.setItem(localStorageKey, '');
  }
}

function getPrevUrlAccount() {
  try {
    if (!platformEnv.isWeb) {
      return;
    }
    const prevAccount = localStorage.getItem(localStorageKey);
    return prevAccount
      ? (JSON.parse(prevAccount) as {
          address: string;
          networkId: string;
        })
      : undefined;
  } catch (error) {
    return undefined;
  }
}

// http://localhost:3000/wallet/account/evm--1/0xF907eBC4348b02F4b808Ec84591AAfD281c4422D
// export const urlAccountLandingRewrite = '/wallet/account/:address/:networkId?';
export const urlAccountLandingRewrite = '/wallet/account/:networkId/:address';
export function buildUrlAccountLandingRoute({
  address,
  networkId,
}: {
  address: string;
  networkId: string;
}) {
  return `/wallet/account/${networkId}/${address}`;
}

export function replaceUrlAccountLandingRoute({
  address,
  networkId,
}: {
  address: string | undefined;
  networkId: string | undefined;
}) {
  if (!platformEnv.isWeb) return;
  if (address && networkId) {
    const url = buildUrlAccountLandingRoute({ address, networkId });
    window.history.replaceState(null, '', url);
  } else {
    window.history.replaceState(null, '', '/');
  }
  savePrevUrlAccount({ address, networkId });
}

export function UrlAccountAutoReplaceHistory({ num }: { num: number }) {
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;
  const { activeAccount } = useActiveAccount({ num });
  const { selectedAccount } = useSelectedAccount({ num });
  const { sceneName } = useAccountSelectorSceneInfo();
  const address = activeAccount?.account?.address;
  const networkId = activeAccount?.network?.id;
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
        sceneName === EAccountSelectorSceneName.home &&
        platformEnv.isWeb &&
        isFocusedRef.current
      ) {
        timerRef.current = setTimeout(() => {
          replaceUrlAccountLandingRoute({ networkId, address });
        }, delay);
      }
    },
    [address, networkId, sceneName],
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

export function UrlAccountAutoCreate({
  redirectToHome,
}: {
  redirectToHome: boolean;
}) {
  const route = useAppRoute();
  const navigation = useAppNavigation();
  const routeParams = route.params as
    | { address: string; networkId?: string }
    | undefined;
  const actions = useAccountSelectorActions();

  useEffect(() => {
    setTimeout(async () => {
      const prevAccount = getPrevUrlAccount();
      if (
        routeParams?.networkId &&
        routeParams?.address &&
        (routeParams?.address?.toLowerCase() !==
          prevAccount?.address?.toLowerCase() ||
          routeParams?.networkId !== prevAccount?.networkId)
      ) {
        try {
          const r = await backgroundApiProxy.serviceAccount.addWatchingAccount({
            input: routeParams?.address,
            networkId: routeParams?.networkId,
            deriveType: undefined,
            isUrlAccount: true,
          });

          void actions.current.updateSelectedAccountForSingletonAccount({
            num: 0,
            networkId: routeParams?.networkId,
            walletId: WALLET_TYPE_WATCHING,
            othersWalletAccountId: r.accounts[0].id,
          });
        } catch (error) {
          Toast.error({
            title: `Unsupported address or network: ${routeParams?.address}`,
          });
        }
      }
      if (redirectToHome) {
        navigation.dispatch(
          // StackActions.replace(ETabHomeRoutes.TabHome, routeParams),
          StackActions.replace(ETabHomeRoutes.TabHome),
        );
      }
    }, 0);
  }, [
    actions,
    navigation,
    redirectToHome,
    routeParams?.address,
    routeParams?.networkId,
  ]);

  return null;
}

export function UrlAccountLanding() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <UrlAccountAutoCreate redirectToHome />
    </AccountSelectorProviderMirror>
  );
}
