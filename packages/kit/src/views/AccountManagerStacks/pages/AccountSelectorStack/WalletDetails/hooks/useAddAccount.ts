import { useCallback } from 'react';

import { useDebouncedCallback } from 'use-debounce';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCreateQrWallet } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useCreateQrWallet';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IDBDevice,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { indexedAccountAddressCreationStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

function resetAddressCreationState() {
  void indexedAccountAddressCreationStateAtom.set(undefined);
}

function addBeforeUnloadListener() {
  // beforeunload not working in Extension popup, check apps/ext/src/background/extUI.ts for more details
  if (platformEnv.isRuntimeBrowser) {
    window.removeEventListener('beforeunload', resetAddressCreationState);
    window.addEventListener('beforeunload', resetAddressCreationState);
  }
}

export function useAddAccount({
  num,
  isOthersUniversal,
  focusedWalletInfo,
}: {
  num: number;
  isOthersUniversal: boolean;
  focusedWalletInfo:
    | {
        wallet: IDBWallet;
        device: IDBDevice | undefined;
      }
    | undefined;
}) {
  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();
  const { createQrWalletAccount } = useCreateQrWallet();
  const { activeAccount } = useActiveAccount({ num });
  const { serviceAccount } = backgroundApiProxy;

  const handleAddAccount = useDebouncedCallback(
    async () => {
      if (isOthersUniversal) {
        const walletId = focusedWalletInfo?.wallet?.id;
        if (walletId === WALLET_TYPE_WATCHING) {
          navigation.pushModal(EModalRoutes.OnboardingModal, {
            screen: EOnboardingPages.ImportAddress,
          });
        } else if (walletId === WALLET_TYPE_IMPORTED) {
          navigation.pushModal(EModalRoutes.OnboardingModal, {
            screen: EOnboardingPages.ImportPrivateKey,
          });
        } else if (walletId === WALLET_TYPE_EXTERNAL) {
          navigation.pushModal(EModalRoutes.OnboardingModal, {
            screen: platformEnv.isWebDappMode
              ? EOnboardingPages.ConnectWalletOptions
              : EOnboardingPages.ConnectWalletSelectNetworks,
          });
        }
        return;
      }
      if (!focusedWalletInfo) {
        return;
      }

      let isNavigationPopped = false;
      const popNavigation = () => {
        if (isNavigationPopped) {
          return;
        }
        isNavigationPopped = true;
        navigation.popStack();
      };

      try {
        const focusedWallet = focusedWalletInfo?.wallet;
        const focusedWalletId = focusedWallet?.id;

        await serviceAccount.generateWalletsMissingMetaWithUserInteraction({
          walletId: focusedWalletId || '',
        });
        const c = await serviceAccount.addHDNextIndexedAccount({
          walletId: focusedWalletId || '',
        });
        await actions.current.updateSelectedAccountForHdOrHwAccount({
          num,
          walletId: focusedWalletId,
          indexedAccountId: c.indexedAccountId,
        });
        const indexedAccount = await serviceAccount.getIndexedAccountSafe({
          id: c.indexedAccountId,
        });
        if (indexedAccount && focusedWallet) {
          const walletIdFromIndexedId = accountUtils.getWalletIdFromAccountId({
            accountId: indexedAccount?.id,
          });
          if (walletIdFromIndexedId === focusedWalletId) {
            addBeforeUnloadListener();
            await indexedAccountAddressCreationStateAtom.set({
              walletId: focusedWalletId,
              indexedAccountId: indexedAccount?.id,
            });
            await timerUtils.wait(1500);
            popNavigation();
            const addDefaultNetworkAccounts = async () =>
              actions.current.addDefaultNetworkAccounts({
                wallet: focusedWallet,
                indexedAccount,
                autoHandleExitError: true,
              });
            const result = await addDefaultNetworkAccounts();
            const isQrWallet = accountUtils.isQrWallet({
              walletId: focusedWalletId,
            });
            if (
              isQrWallet &&
              (activeAccount?.network?.id !== getNetworkIdsMap().onekeyall
                ? result?.failedAccounts?.find(
                    (account) =>
                      account.networkId === activeAccount?.network?.id,
                  )
                : result?.failedAccounts?.length)
            ) {
              await createQrWalletAccount({
                walletId: focusedWalletId,
                networkId:
                  activeAccount?.network?.id || getNetworkIdsMap().onekeyall,
                indexedAccountId: indexedAccount.id,
              });
              await addDefaultNetworkAccounts();
            }
          }
        }
      } finally {
        resetAddressCreationState();
        if (focusedWalletInfo.device?.connectId) {
          await backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog(
            {
              connectId: focusedWalletInfo.device?.connectId,
              hardClose: true,
            },
          );
        }
        appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
        popNavigation();
      }
    },
    300,
    {
      leading: true,
      trailing: false,
    },
  );

  return {
    handleAddAccount,
  };
}
