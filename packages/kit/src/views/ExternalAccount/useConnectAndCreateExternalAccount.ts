import { useCallback } from 'react';

import { OnekeyNetwork } from '@onekeyhq/engine/src/presets/networkIds';
import { IAccount } from '@onekeyhq/engine/src/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
        networkId: networkId || OnekeyNetwork.eth,
      });

      addedAccount = await addExternalAccount(result);
    } catch (error) {
      debugLogger.common.error(error);
    } finally {
      await wait(2000);

      if (isConnected) {
        // refresh accounts in drawer list after created

        await serviceAccountSelector.preloadingCreateAccountDone({
          walletId,
          networkId: networkId || OnekeyNetwork.eth,
          accountId: addedAccount?.id,
        });
      }
    }
  }, [
    externalWallet,
    addExternalAccount,
    connectToWallet,
    networkId,
    serviceAccountSelector,
  ]);

  const goToOnboardingConnectWallet = useCallback(
    () =>
      navigation.navigate(RootRoutes.Onboarding, {
        screen: EOnboardingRoutes.ConnectWallet,
        params: {
          disableAnimation: true,
        },
      }),
    [navigation],
  );

  const connectAndCreateExternalAccount = useCallback(async () => {
    // web can connect to injected and wallet-connect
    if (platformEnv.isWeb) {
      goToOnboardingConnectWallet();
      return;
    }

    // desktop and app can only connect wallet-connect
    await connectToWcWalletDirectly();
  }, [connectToWcWalletDirectly, goToOnboardingConnectWallet]);

  return {
    goToOnboardingConnectWallet,
    connectToWcWalletDirectly,
    connectAndCreateExternalAccount,
  };
}
