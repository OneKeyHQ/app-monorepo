import React, {
  FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import { Button, useToast } from '@onekeyhq/components';
import { isExternalWallet } from '@onekeyhq/engine/src/engineUtils';
import { OnekeyNetwork } from '@onekeyhq/engine/src/presets/networkIds';
import { IAccount } from '@onekeyhq/engine/src/types';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { IVaultSettings } from '@onekeyhq/engine/src/vaults/types';
import { useNavigation } from '@onekeyhq/kit/src/hooks';
import {
  CreateAccountModalRoutes,
  CreateWalletModalRoutes,
} from '@onekeyhq/kit/src/routes';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { wait } from '../../../utils/helper';
import { useAddExternalAccount } from '../../WalletConnect/useAddExternalAccount';
import { useWalletConnectQrcodeModal } from '../../WalletConnect/useWalletConnectQrcodeModal';
import { WALLET_CONNECT_NEW_CONNECTION_BUTTON_LOADING } from '../../WalletConnect/walletConnectConsts';
import { InitWalletServicesData } from '../../WalletConnect/WalletConnectQrcodeModal';

import { AllNetwork } from './RightChainSelector';

type Props = {
  activeWallet: null | Wallet | undefined;
  isLoading: boolean;
  selectedNetworkId: string | undefined;
  activeNetwork: null | Network;
};

export const NETWORK_NOT_SUPPORT_CREATE_ACCOUNT_I18N_KEY =
  'content__str_chain_is_unsupprted';

export function useCreateAccountInWallet({
  networkId,
  walletId,
}: {
  networkId?: string;
  walletId?: string;
}) {
  const { engine, serviceAccountSelector } = backgroundApiProxy;
  const navigation = useNavigation();
  const toast = useToast();
  const intl = useIntl();
  const { connectToWallet } = useWalletConnectQrcodeModal();
  const addExternalAccount = useAddExternalAccount();

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
    if (network?.id) {
      if (
        activeWallet?.type === 'external' &&
        vaultSettings?.externalAccountEnabled
      ) {
        isCreateAccountSupported = true;
      }
      if (
        activeWallet?.type === 'imported' &&
        vaultSettings?.importedAccountEnabled
      ) {
        isCreateAccountSupported = true;
      }
      if (
        activeWallet?.type === 'watching' &&
        vaultSettings?.watchingAccountEnabled
      ) {
        isCreateAccountSupported = true;
      }
      if (
        activeWallet?.type === 'hw' &&
        vaultSettings?.hardwareAccountEnabled
      ) {
        isCreateAccountSupported = true;
      }
      if (activeWallet?.type === 'hd') {
        isCreateAccountSupported = true;
      }
    } else {
      // AllNetwork
      isCreateAccountSupported = true;
    }

    return {
      selectedNetworkId,
      network,
      activeWallet,
      vaultSettings,
      isCreateAccountSupported,
    };
  }, [networkId, walletId]);

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
    const showNotSupportToast = () => {
      toast.show({
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
      let isConnected = false;
      let addedAccount: IAccount | undefined;
      try {
        const result = await connectToWallet({
          isNewSession: true,
        });
        isConnected = true;

        // refresh accounts in drawer list
        await serviceAccountSelector.preloadingCreateAccount({
          walletId: activeWallet.id,
          networkId: network?.id || OnekeyNetwork.eth,
        });

        addedAccount = await addExternalAccount(result);
      } catch (error) {
        debugLogger.common.error(error);
      } finally {
        await wait(2000);

        if (isConnected) {
          // refresh accounts in drawer list after created

          await serviceAccountSelector.preloadingCreateAccountDone({
            walletId: activeWallet.id,
            networkId: network?.id || OnekeyNetwork.eth,
            accountId: addedAccount?.id,
          });
        }
      }
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
          params: { mode: 'imported' },
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
          params: { mode: 'watching' },
        },
      });
    }

    return navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.CreateAccount,
      params: {
        screen: CreateAccountModalRoutes.CreateAccountForm,
        params: {
          walletId: activeWallet?.id || '',
          selectedNetworkId,
        },
      },
    });
  }, [
    addExternalAccount,
    connectToWallet,
    intl,
    navigation,
    serviceAccountSelector,
    toast,
    walletAndNetworkInfo,
    walletId,
  ]);
  return {
    createAccount,
    isCreateAccountSupported: walletAndNetworkInfo?.isCreateAccountSupported,
  };
}

const RightAccountCreateButton: FC<Props> = ({
  activeWallet,
  isLoading,
  selectedNetworkId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  activeNetwork,
}) => {
  const intl = useIntl();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { createAccount, isCreateAccountSupported } = useCreateAccountInWallet({
    networkId: selectedNetworkId,
    walletId: activeWallet?.id,
  });
  const isExternal = useMemo(() => {
    if (!activeWallet?.id) {
      return false;
    }
    return isExternalWallet({ walletId: activeWallet?.id });
  }, [activeWallet?.id]);

  // const isDisabled = selectedNetworkId === AllNetwork
  // if (selectedNetworkId === AllNetwork) return null;

  const initWalletServiceRef = useRef<JSX.Element | undefined>();

  useEffect(() => {
    // iOS should open walletServices list Modal
    if (platformEnv.isNativeIOS) {
      return;
    }
    if (initWalletServiceRef.current) {
      return;
    }
    if (isExternal) {
      initWalletServiceRef.current = <InitWalletServicesData />;
    }
  }, [isExternal]);

  const [isCreatLoading, setIsCreatLoading] = useState(false);
  const timerRef = useRef<any>();
  return (
    <>
      {initWalletServiceRef.current}
      <Button
        testID="AccountSelectorChildren-RightAccountCreateButton"
        leftIconName="UserAddSolid"
        size="xl"
        isLoading={isLoading || isCreatLoading}
        onPress={async () => {
          if (!activeWallet || isLoading) return;
          try {
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(
              () => setIsCreatLoading(false),
              WALLET_CONNECT_NEW_CONNECTION_BUTTON_LOADING,
            );
            setIsCreatLoading(true);

            await createAccount();
          } finally {
            clearTimeout(timerRef.current);
            setIsCreatLoading(false);
          }
        }}
      >
        {intl.formatMessage({ id: 'action__add_account' })}
      </Button>
    </>
  );
};

export default memo(RightAccountCreateButton);
