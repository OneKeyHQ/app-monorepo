import { useCallback, useEffect, useRef, useState } from 'react';

import type { IAccountSelectorRouteParamsExtraConfig } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useAccountSelectorActions,
  useAccountSelectorSceneInfo,
  useActiveAccount,
  useSelectedAccount,
} from '../../../states/jotai/contexts/accountSelector';

export function useAccountSelectorTrigger({
  num,
  showConnectWalletModalInDappMode,
  ...others
}: {
  num: number;
  showConnectWalletModalInDappMode?: boolean;
} & IAccountSelectorRouteParamsExtraConfig) {
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num });
  const { selectedAccount } = useSelectedAccount({ num });
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();
  const actions = useAccountSelectorActions();

  const activeAccountRef = useRef(activeAccount);
  activeAccountRef.current = activeAccount;
  const selectedAccountRef = useRef(selectedAccount);
  selectedAccountRef.current = selectedAccount;

  const showAccountSelector = useCallback(() => {
    console.log(
      'showAccountSelector>>>>',
      activeAccountRef.current,
      selectedAccountRef.current,
    );
    void actions.current.showAccountSelector({
      activeWallet: activeAccount.wallet,
      num,
      navigation,
      sceneName,
      sceneUrl,
      showConnectWalletModalInDappMode,
      ...others,
    });
  }, [
    actions,
    activeAccount.wallet,
    others,
    navigation,
    num,
    sceneName,
    sceneUrl,
    showConnectWalletModalInDappMode,
  ]);

  return {
    showAccountSelector,
    activeAccount,
  };
}

export function useMockAccountSelectorLoading(duration = 500) {
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, duration);
  }, [duration]);
  return {
    isLoading,
  };
}
