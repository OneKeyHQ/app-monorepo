import React, { FC, memo } from 'react';

import { useIntl } from 'react-intl';

import {
  HStack,
  Icon,
  Pressable,
  Typography,
  useToast,
} from '@onekeyhq/components';
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
    <Pressable
      disabled={selectedNetworkId === AllNetwork}
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
      {({ isHovered }) => (
        <HStack
          py={3}
          borderRadius="xl"
          space={3}
          borderWidth={1}
          borderColor={isHovered ? 'border-hovered' : 'border-subdued'}
          borderStyle="dashed"
          alignItems="center"
          justifyContent="center"
        >
          <Icon name="UserAddOutline" />
          <Typography.Body2Strong color="text-subdued">
            {intl.formatMessage({ id: 'action__add_account' })}
          </Typography.Body2Strong>
        </HStack>
      )}
    </Pressable>
  );
};

export default memo(RightAccountCreateButton);
