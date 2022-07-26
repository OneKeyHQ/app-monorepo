import React, { FC, memo } from 'react';

import { useIntl } from 'react-intl';

import { Button, useToast } from '@onekeyhq/components';
import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { useNavigation, useNavigationActions } from '@onekeyhq/kit/src/hooks';
import {
  CreateAccountModalRoutes,
  CreateWalletModalRoutes,
} from '@onekeyhq/kit/src/routes';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { closeExtensionWindowIfOnboardingFinished } from '../../../hooks/useOnboardingFinished';
import { useConnectExternalByWalletConnect } from '../../WalletConnect/useConnectExternalByWalletConnect';
import { useWalletConnectQrcodeModal } from '../../WalletConnect/WalletConnectQrcodeModal';

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
  const { onPress, text } = useConnectExternalByWalletConnect();
  const { serviceAccount } = backgroundApiProxy;
  const navigation = useNavigation();
  const intl = useIntl();
  const toast = useToast();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { closeDrawer, resetToRoot } = useNavigationActions();

  const { qrcodeModalElement, connectToWallet } = useWalletConnectQrcodeModal();

  if (selectedNetworkId === AllNetwork) return null;

  return (
    <>
      {qrcodeModalElement}
      <Button
        testID="AccountSelectorChildren-RightAccountCreateButton"
        leftIconName="UserAddSolid"
        size="xl"
        isDisabled={selectedNetworkId === AllNetwork}
        isLoading={isLoading}
        onPress={async () => {
          if (!activeWallet || isLoading) return;
          const networkSettings = activeNetwork?.settings;
          const networkId =
            selectedNetworkId === AllNetwork ? undefined : selectedNetworkId;

          const showNotSupportToast = () => {
            toast.show({
              title: intl.formatMessage({ id: 'badge__coming_soon' }),
            });
          };
          if (activeWallet?.type === 'external' && activeNetwork?.id) {
            if (!networkSettings?.externalAccountEnabled) {
              showNotSupportToast();
              return;
            }

            try {
              const { status, session, client } = await connectToWallet({
                isNewSession: true,
              });

              console.log(
                'connect new session:',
                status,
                session,
                client.walletService,
              );

              const { chainId } = status;
              let address = status.accounts?.[0] || '';
              // EVM address should be lowerCase
              address = address.toLowerCase();

              const id = activeWallet?.nextAccountIds?.global;
              const accountName = id ? `External #${id}` : '';
              onLoadingAccount?.(activeWallet.id, activeNetwork?.id, false);
              const addedAccount = await serviceAccount.addExternalAccount({
                impl: IMPL_EVM,
                chainId,
                address,
                name: accountName,
              });
              const accountId = addedAccount.id;
              // closeDrawer();
              // resetToRoot();
              // closeExtensionWindowIfOnboardingFinished();

              client.watchAccountSessionChanged({ accountId });
              if (session) {
                await client.saveAccountSession({
                  accountId,
                  session,
                });
              }
            } catch (error) {
              console.error(error);
            } finally {
              onLoadingAccount?.(activeWallet.id, activeNetwork?.id, true);
            }
            return;
          }
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
    </>
  );
};

export default memo(RightAccountCreateButton);
