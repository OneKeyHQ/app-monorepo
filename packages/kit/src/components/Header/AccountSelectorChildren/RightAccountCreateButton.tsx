import React, { FC, memo } from 'react';

import { useIntl } from 'react-intl';

import { Button, useToast } from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { useNavigation } from '@onekeyhq/kit/src/hooks';
import {
  CreateAccountModalRoutes,
  CreateWalletModalRoutes,
} from '@onekeyhq/kit/src/routes';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import { AllNetwork } from './RightChainSelector';

type Props = {
  activeWallet: null | Wallet;
  isLoading: boolean;
  selectedNetworkId: string;
  activeNetwork: null | Network;
  onLoadingAccount: (
    walletId: string,
    networkId: string,
    ready?: boolean,
  ) => void;
};

const RightAccountCreateButton: FC<Props> = ({
  activeWallet,
  isLoading,
  selectedNetworkId,
  activeNetwork,
  onLoadingAccount,
}) => {
  const navigation = useNavigation();
  const intl = useIntl();
  const toast = useToast();

  if (selectedNetworkId === AllNetwork) return null;

  return (
    <Button
      leftIconName="UserAddSolid"
      size="xl"
      isDisabled={selectedNetworkId === AllNetwork}
      isLoading={isLoading}
      onPress={() => {
        if (!activeWallet || isLoading) return;
        const networkSettings = activeNetwork?.settings;
        const networkId =
          selectedNetworkId === AllNetwork ? undefined : selectedNetworkId;

        const showNotSupportToast = () => {
          toast.show({
            title: intl.formatMessage({ id: 'badge__coming_soon' }),
          });
        };
        if (activeWallet?.type === 'imported') {
          if (!networkSettings?.importedAccountEnabled) {
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
          if (!networkSettings?.watchingAccountEnabled) {
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
              walletId: activeWallet.id,
              onLoadingAccount,
              selectedNetworkId: networkId,
            },
          },
        });
      }}
    >
      {intl.formatMessage({ id: 'action__add_account' })}
    </Button>
  );
};

export default memo(RightAccountCreateButton);
