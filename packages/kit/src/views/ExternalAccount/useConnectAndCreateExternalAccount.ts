import { useCallback } from 'react';

import type { IAccount } from '@onekeyhq/engine/src/types';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useWalletConnectQrcodeModal } from '../../components/WalletConnect/useWalletConnectQrcodeModal';
import { useActiveWalletAccount, useNavigation } from '../../hooks';
import { RootRoutes } from '../../routes/routesEnum';
import { wait } from '../../utils/helper';
import { EOnboardingRoutes } from '../Onboarding/routes/enums';

import { useAddExternalAccount } from './useAddExternalAccount';

export function useConnectAndCreateExternalAccount({
  networkId,
}: {
  networkId?: string;
} = {}) {
  const navigation = useNavigation();
  const { serviceAccountSelector } = backgroundApiProxy;

  const { connectToWallet } = useWalletConnectQrcodeModal();
  const { addExternalAccount } = useAddExternalAccount();
  const { externalWallet } = useActiveWalletAccount();

  const connectToWcWalletDirectly = useCallback(async () => {
    let preloadingNetworkId = networkId || OnekeyNetwork.eth;
    let isConnected = false;
    const walletId = externalWallet?.id;
    let addedAccount: IAccount | undefined;
    if (!walletId) {
      return;
    }
    try {
      const result = await connectToWallet({
        isNewSession: true,
      });
      isConnected = true;

      // refresh accounts in drawer list
      await serviceAccountSelector.preloadingCreateAccount({
        walletId,
        networkId: preloadingNetworkId,
      });

      const addedResult = await addExternalAccount(result);
      addedAccount = addedResult.account;
      preloadingNetworkId = addedResult.networkId;
    } catch (error) {
      debugLogger.common.error(error);
    } finally {
      await wait(2000);

      if (isConnected) {
        // refresh accounts in drawer list after created

        await serviceAccountSelector.preloadingCreateAccountDone({
          walletId,
          networkId: preloadingNetworkId,
          accountId: addedAccount?.id,
        });
      }
    }
  }, [
    addExternalAccount,
    connectToWallet,
    externalWallet?.id,
    networkId,
    serviceAccountSelector,
  ]);

  const goToOnboardingConnectWallet = useCallback(
    () =>
      navigation.navigate(RootRoutes.Onboarding, {
        screen: EOnboardingRoutes.BTCExternalWallet,
        params: {
          disableAnimation: true,
          disableOnboardingDone: true,
        },
      }),
    [navigation],
  );

  const connectAndCreateExternalAccount = useCallback(() => {
    // Web can connect to injected and wallet-connect
    // so go to onboarding for selecting wallet
    goToOnboardingConnectWallet();
    // if (platformEnv.isWeb) {
    //   return;
    // }

    // // Desktop and App can ONLY connect wallet-connect
    // await connectToWcWalletDirectly();
  }, [goToOnboardingConnectWallet]);

  return {
    goToOnboardingConnectWallet,
    connectToWcWalletDirectly,
    connectAndCreateExternalAccount,
  };
}
