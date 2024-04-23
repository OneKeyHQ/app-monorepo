import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import { ToastManager } from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import type { IVaultSettings } from '@onekeyhq/engine/src/vaults/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  CreateAccountModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';
import { deviceUtils } from '../../../utils/hardware';
import { useConnectAndCreateExternalAccount } from '../../../views/ExternalAccount/useConnectAndCreateExternalAccount';
import { EOnboardingRoutes } from '../../../views/Onboarding/routes/enums';
import showDerivationPathBottomSheetModal from '../modals/NetworkAccountSelectorModal/DerivationPathBottomSheetModal';

import type { ModalScreenProps, RootRoutesParams } from '../../../routes/types';
import type { IDerivationOption } from './useDerivationPath';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type NavigationProps = ModalScreenProps<RootRoutesParams>;

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
  const navigation = useAppNavigation();

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
    let isAddressDerivationSupported = true;
    if (!network?.id) {
      // AllNetwork
      isCreateAccountSupported = true;
      showCreateAccountMenu = false;
      isAddressDerivationSupported = true;
    } else if (isAllNetworks(network.id)) {
      isCreateAccountSupported = true;
      showCreateAccountMenu = false;
      isAddressDerivationSupported = true;
    } else {
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

      if (vaultSettings?.addressDerivationDisabled) {
        isAddressDerivationSupported = false;
      }
    }

    return {
      selectedNetworkId,
      network,
      activeWallet,
      vaultSettings,
      isCreateAccountSupported,
      isAddressDerivationSupported,
      showCreateAccountMenu,
    };
  }, [engine, networkId, walletId]);

  const selectedTemplateRef = useRef<IDerivationOption | null>();
  const quickCreateAllNetworksFakeAccount = useCallback(async () => {
    const { serviceAllNetwork } = backgroundApiProxy;
    if (!walletId) {
      return;
    }
    try {
      return await serviceAllNetwork.createAllNetworksFakeAccount({
        walletId,
      });
    } catch (e) {
      console.error(e);
      debugLogger.common.error(`createAllNetworksFakeAccount error: `, e);
      deviceUtils.showErrorToast(e);
    }
  }, [walletId]);
  const quickCreateAccount = useCallback(
    async (password: string) => {
      const { selectedNetworkId } = walletAndNetworkInfo ?? {};
      if (!walletId || !selectedNetworkId) return;
      const { serviceDerivationPath } = backgroundApiProxy;
      try {
        const { quickCreateAccountInfo } =
          await serviceDerivationPath.getNetworkDerivations(
            walletId,
            selectedNetworkId,
          );
        await serviceDerivationPath.createNewAccount(
          password,
          walletId,
          selectedNetworkId,
          selectedTemplateRef.current
            ? selectedTemplateRef.current.template
            : quickCreateAccountInfo?.template ?? '',
        );
      } catch (e) {
        console.error(e);
        deviceUtils.showErrorToast(e);
      } finally {
        if (navigation.getParent()) {
          navigation.getParent()?.goBack?.();
        } else {
          navigation.goBack?.();
        }
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
      connectAndCreateExternalAccount();
      return;
    }
    if (activeWallet?.type === 'imported') {
      if (network?.id && !vaultSettings?.importedAccountEnabled) {
        showNotSupportToast();
        return;
      }
      navigation.goBack?.();
      return navigation.navigate(RootRoutes.Onboarding, {
        screen: EOnboardingRoutes.RecoveryWallet,
        params: {
          mode: 'imported',
        },
      });
    }
    if (activeWallet?.type === 'watching') {
      if (network?.id && !vaultSettings?.watchingAccountEnabled) {
        showNotSupportToast();
        return;
      }
      navigation.goBack?.();
      return navigation.navigate(RootRoutes.Onboarding, {
        screen: EOnboardingRoutes.RecoveryWallet,
        params: {
          mode: 'watching',
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
      selectedTemplateRef.current = null;
      if (isAllNetworks(selectedNetworkId)) {
        return quickCreateAllNetworksFakeAccount();
      }
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

    showDerivationPathBottomSheetModal({
      type: 'create',
      walletId,
      networkId: selectedNetworkId,
      onSelect: (options) => {
        selectedTemplateRef.current = options;
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
      },
    });
  }, [
    quickCreateAllNetworksFakeAccount,
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
    isAddressDerivationSupported:
      walletAndNetworkInfo?.isAddressDerivationSupported,
  };
}
