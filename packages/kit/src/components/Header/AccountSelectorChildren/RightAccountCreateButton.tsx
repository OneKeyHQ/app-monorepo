import React, { FC, memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, useToast } from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { IVaultSettings } from '@onekeyhq/engine/src/vaults/types';
import { useNavigation } from '@onekeyhq/kit/src/hooks';
import {
  CreateAccountModalRoutes,
  CreateWalletModalRoutes,
} from '@onekeyhq/kit/src/routes';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { wait } from '../../../utils/helper';
import { useAddExternalAccount } from '../../WalletConnect/useAddExternalAccount';
import { useWalletConnectQrcodeModal } from '../../WalletConnect/useWalletConnectQrcodeModal';

import { AllNetwork } from './RightChainSelector';

type OnLoadingAccountCallback = (
  walletId: string,
  networkId: string,
  ready?: boolean,
) => void;
type Props = {
  activeWallet: null | Wallet;
  isLoading: boolean;
  selectedNetworkId: string;
  activeNetwork: null | Network;
  onLoadingAccount: OnLoadingAccountCallback;
};

export function useCreateAccountInWallet({
  networkId,
  walletId,
  onLoadingAccount,
}: {
  networkId?: string;
  walletId?: string;
  onLoadingAccount?: OnLoadingAccountCallback;
}) {
  const { engine } = backgroundApiProxy;
  const navigation = useNavigation();
  const toast = useToast();
  const intl = useIntl();
  const { connectToWallet } = useWalletConnectQrcodeModal();
  const addExternalAccount = useAddExternalAccount();

  const createAccount = useCallback(async () => {
    if (!walletId) {
      return;
    }
    const selectedNetworkId = networkId === AllNetwork ? undefined : networkId;

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

    const showNotSupportToast = () => {
      toast.show({
        title: intl.formatMessage({ id: 'badge__coming_soon' }),
      });
    };

    if (activeWallet?.type === 'external' && network?.id) {
      if (!vaultSettings?.externalAccountEnabled) {
        showNotSupportToast();
        return;
      }

      try {
        const result = await connectToWallet({
          isNewSession: true,
        });

        // refresh accounts in drawer list
        onLoadingAccount?.(activeWallet.id, network?.id, false);

        await addExternalAccount(result);
      } catch (error) {
        console.error(error);
      } finally {
        await wait(2000);

        // refresh accounts in drawer list after created
        onLoadingAccount?.(activeWallet.id, network?.id, true);
      }
      return;
    }
    if (activeWallet?.type === 'imported') {
      if (!vaultSettings?.importedAccountEnabled) {
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
      if (!vaultSettings?.watchingAccountEnabled) {
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
          onLoadingAccount,
          selectedNetworkId,
        },
      },
    });
  }, [
    addExternalAccount,
    connectToWallet,
    engine,
    intl,
    navigation,
    networkId,
    onLoadingAccount,
    toast,
    walletId,
  ]);
  return { createAccount };
}

const RightAccountCreateButton: FC<Props> = ({
  activeWallet,
  isLoading,
  selectedNetworkId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  activeNetwork,
  onLoadingAccount,
}) => {
  const intl = useIntl();

  const { createAccount } = useCreateAccountInWallet({
    networkId: selectedNetworkId,
    walletId: activeWallet?.id,
    onLoadingAccount,
  });
  if (selectedNetworkId === AllNetwork) return null;

  return (
    <>
      <Button
        testID="AccountSelectorChildren-RightAccountCreateButton"
        leftIconName="UserAddSolid"
        size="xl"
        isDisabled={selectedNetworkId === AllNetwork}
        isLoading={isLoading}
        onPress={async () => {
          if (!activeWallet || isLoading) return;
          await createAccount();
        }}
      >
        {intl.formatMessage({ id: 'action__add_account' })}
      </Button>
    </>
  );
};

export default memo(RightAccountCreateButton);
