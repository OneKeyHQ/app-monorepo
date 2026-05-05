import { useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function useWebDappWalletSelector({
  num,
  focusedWallet,
}: {
  num: number;
  focusedWallet: string | undefined;
}) {
  const actions = useAccountSelectorActions();

  // Check if user has hardware wallet (only in WebDapp mode)
  const { result: hasHardwareWallet, run: reloadWalletCheck } =
    usePromiseResult(async () => {
      if (!platformEnv.isWebDappMode) {
        return false;
      }
      const { wallets } = await backgroundApiProxy.serviceAccount.getWallets({
        nestedHiddenWallets: false,
      });
      return wallets.some((w) => w.type === 'hw');
    }, []);

  // Listen for wallet updates to refresh the hardware wallet check
  // and auto-switch to first available wallet if current wallet is deleted
  useEffect(() => {
    const fn = async () => {
      await reloadWalletCheck();
      // In WebDapp mode, if current wallet is deleted, auto-switch to first available wallet
      if (platformEnv.isWebDappMode) {
        const { wallets } = await backgroundApiProxy.serviceAccount.getWallets({
          nestedHiddenWallets: false,
        });
        if (wallets.length > 0) {
          const currentWalletExists = wallets.some(
            (w) => w.id === focusedWallet,
          );
          if (!currentWalletExists) {
            void actions.current.updateSelectedAccountFocusedWallet({
              num,
              focusedWallet: wallets[0].id,
            });
          }
        }
      }
    };
    appEventBus.on(EAppEventBusNames.WalletUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, fn);
    };
  }, [reloadWalletCheck, focusedWallet, actions, num]);

  // Hide wallet list only in WebDapp mode AND when confirmed no hardware wallet
  // Use `=== false` to avoid hiding during loading state
  const shouldHideWalletList =
    platformEnv.isWebDappMode && hasHardwareWallet === false;

  return {
    shouldHideWalletList,
    hasHardwareWallet,
  };
}
