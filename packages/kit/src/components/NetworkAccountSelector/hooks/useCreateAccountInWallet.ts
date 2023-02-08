import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ToastManager } from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import type { IVaultSettings } from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../hooks';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  CreateAccountModalRoutes,
  CreateWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';
import { deviceUtils } from '../../../utils/hardware';
import { useConnectAndCreateExternalAccount } from '../../../views/ExternalAccount/useConnectAndCreateExternalAccount';
import showDerivationPathBottomSheetModal from '../modals/NetworkAccountSelectorModal/DerivationPathBottomSheetModal';

export const AllNetwork = 'all';
export const NETWORK_NOT_SUPPORT_CREATE_ACCOUNT_I18N_KEY =
  'content__str_chain_is_unsupprted';

export function useCreateAccountInWallet({
  networkId,
  walletId,
  isFromAccountSelector,
}: {
  networkId?: string;
  walletId?: string;
  isFromAccountSelector?: boolean;
}) {
  const { engine } = backgroundApiProxy;
  const navigation = useNavigation();

  const intl = useIntl();
  const { connectAndCreateExternalAccount } =
    useConnectAndCreateExternalAccount({
      networkId,
    });

  const { result: walletAndNetworkInfo } = usePromiseResult(async () => {
    const selectedNetworkId =
      !networkId || networkId === AllNetwork ? undefined : networkId;

    let network: Network | undefined;
    let activeWallet: Wallet | undefined;
    let vaultSettings: IVaultSettings | undefined;

    if (selectedNetworkId) {
      network = await engine.getNetwork(selectedNetworkId);
      vaultSettings = await engine.getVaultSettings(selectedNetworkId);
    }
    if (walletId) {
      activeWallet = await engine.getWallet(walletId);
    }

    let isCreateAccountSupported = false;
    let showCreateAccountMenu = false;
    if (network?.id) {
      if (
        activeWallet?.type === 'external' &&
        vaultSettings?.externalAccountEnabled
      ) {
        isCreateAccountSupported = true;
        showCreateAccountMenu = false;
      }
      if (
        activeWallet?.type === 'imported' &&
        vaultSettings?.importedAccountEnabled
      ) {
        isCreateAccountSupported = true;
        showCreateAccountMenu = false;
      }
      if (
        activeWallet?.type === 'watching' &&
        vaultSettings?.watchingAccountEnabled
      ) {
        isCreateAccountSupported = true;
        showCreateAccountMenu = false;
      }
      if (
        activeWallet?.type === 'hw' &&
        vaultSettings?.hardwareAccountEnabled
      ) {
        isCreateAccountSupported = true;
        showCreateAccountMenu = true;
      }
      if (activeWallet?.type === 'hd') {
        isCreateAccountSupported = true;
        showCreateAccountMenu = true;
      }
    } else {
      // AllNetwork
      isCreateAccountSupported = true;
      showCreateAccountMenu = false;
    }

    return {
      selectedNetworkId,
      network,
      activeWallet,
      vaultSettings,
      isCreateAccountSupported,
      showCreateAccountMenu,
    };
  }, [networkId, walletId]);

  const quickCreateAccount = useCallback(
    async (password: string) => {
      const { selectedNetworkId } = walletAndNetworkInfo ?? {};
      if (!walletId || !selectedNetworkId) return;
      const { serviceDerivationPath } = backgroundApiProxy;
      const { quickCreateAccountInfo } =
        await serviceDerivationPath.getNetworkDerivations(
          walletId,
          selectedNetworkId,
        );
      try {
        await serviceDerivationPath.createNewAccount(
          password,
          walletId,
          selectedNetworkId,
          quickCreateAccountInfo?.template ?? '',
        );
      } catch (e) {
        deviceUtils.showErrorToast(e);
      } finally {
        navigation.getParent()?.goBack?.();
      }
    },
    [walletAndNetworkInfo, walletId, navigation],
  );

  const createAccount = useCallback(async () => {
    if (!walletId) {
      return;
    }
    const {
      activeWallet,
      vaultSettings,
      network,
      selectedNetworkId,
      isCreateAccountSupported,
    } = walletAndNetworkInfo ?? {};
    const { serviceDerivationPath } = backgroundApiProxy;
    const showNotSupportToast = () => {
      ToastManager.show({
        title: intl.formatMessage(
          {
            id: NETWORK_NOT_SUPPORT_CREATE_ACCOUNT_I18N_KEY,
          },
          { 0: network?.shortName },
        ),
      });
    };
    if (!isCreateAccountSupported) {
      showNotSupportToast();
      return;
    }

    if (activeWallet?.type === 'external') {
      await connectAndCreateExternalAccount();
      return;
    }
    if (activeWallet?.type === 'imported') {
      if (network?.id && !vaultSettings?.importedAccountEnabled) {
        showNotSupportToast();
        return;
      }
      return navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.CreateWallet,
        params: {
          screen: CreateWalletModalRoutes.AddExistingWalletModal,
          params: { mode: 'imported', wallet: activeWallet },
        },
      });
    }
    if (activeWallet?.type === 'watching') {
      if (network?.id && !vaultSettings?.watchingAccountEnabled) {
        showNotSupportToast();
        return;
      }
      return navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.CreateWallet,
        params: {
          screen: CreateWalletModalRoutes.AddExistingWalletModal,
          params: { mode: 'watching', wallet: activeWallet },
        },
      });
    }

    if (isFromAccountSelector) {
      // TODO add back button in route params
    }

    if (!selectedNetworkId) {
      return;
    }

    const { shouldQuickCreate } =
      await serviceDerivationPath.getNetworkDerivations(
        walletId,
        selectedNetworkId,
      );
    if (shouldQuickCreate) {
      return navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.CreateAccount,
        params: {
          screen: CreateAccountModalRoutes.CreateAccountAuthentication,
          params: {
            walletId: activeWallet?.id || '',
            onDone: quickCreateAccount,
          },
        },
      });
    }

    showDerivationPathBottomSheetModal(selectedNetworkId);

    // serviceAccountSelector.preloadingCreateAccount({
    //   walletId,
    //   networkId: selectedNetworkId,
    // });
    // setTimeout(() => {
    //   serviceAccount
    //     .addHDAccounts(
    //       password,
    //       selectedWalletId,
    //       network,
    //       undefined,
    //       [name],
    //       purpose,
    //       false,
    //       template,
    //     )
    //     .then((acc) => {
    //       addedAccount = acc?.[0];
    //     })
    //     .catch((e) => {
    //       setTimeout(() => {
    //         deviceUtils.showErrorToast(e);
    //       }, 300);
    //     })
    //     .finally(() => {
    //       serviceAccountSelector.preloadingCreateAccountDone({
    //         walletId: selectedWalletId,
    //         networkId: network,
    //         accountId: addedAccount?.id,
    //       });
    //       // setIsLoading(false);
    //       navigation.getParent()?.goBack?.();
    //     });
    // }, 10);

    // return navigation.navigate(RootRoutes.Modal, {
    //   screen: ModalRoutes.CreateAccount,
    //   params: {
    //     screen: CreateAccountModalRoutes.CreateAccountForm,
    //     params: {
    //       walletId: activeWallet?.id || '',
    //       selectedNetworkId,
    //     },
    //   },
    // });
  }, [
    connectAndCreateExternalAccount,
    intl,
    isFromAccountSelector,
    navigation,
    walletAndNetworkInfo,
    walletId,
    quickCreateAccount,
  ]);
  return {
    createAccount,
    isCreateAccountSupported: walletAndNetworkInfo?.isCreateAccountSupported,
    showCreateAccountMenu: walletAndNetworkInfo?.showCreateAccountMenu,
  };
}
