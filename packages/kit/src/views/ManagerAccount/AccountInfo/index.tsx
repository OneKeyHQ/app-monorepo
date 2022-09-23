import React, { FC, useCallback, useEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Container,
  Modal,
  Typography,
  useToast,
} from '@onekeyhq/components';
import { Account } from '@onekeyhq/engine/src/types/account';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  ManagerAccountModalRoutes,
  ManagerAccountRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/ManagerAccount';

import { ValidationFields } from '../../../components/Protected';
import { useActiveWalletAccount } from '../../../hooks';
import useLocalAuthenticationModal from '../../../hooks/useLocalAuthenticationModal';
import { useWalletName } from '../../../hooks/useWalletName';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import AccountModifyNameDialog from '../ModifyAccount';
import useRemoveAccountDialog from '../RemoveAccount';

type RouteProps = RouteProp<
  ManagerAccountRoutesParams,
  ManagerAccountModalRoutes.ManagerAccountModal
>;

const ManagerAccountModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();

  const { showVerify } = useLocalAuthenticationModal();
  const { show: showRemoveAccountDialog, RemoveAccountDialog } =
    useRemoveAccountDialog();
  const [modifyNameVisible, setModifyNameVisible] = useState(false);
  const [modifyNameAccount, setModifyNameAccount] = useState<Account>();
  const { walletId, accountId, networkId, refreshAccounts } =
    useRoute<RouteProps>().params;
  const { network } = useActiveWalletAccount();
  const toast = useToast();

  const [wallet, setWallet] = useState<Wallet>();
  const [account, setAccount] = useState<Account>();

  const refreshWallet = useCallback(() => {
    if (!walletId) return;

    backgroundApiProxy.engine.getWallet(walletId).then(($wallet) => {
      setWallet($wallet);
    });
  }, [walletId]);

  const refreshAccount = useCallback(() => {
    if (!accountId || !networkId) return;

    backgroundApiProxy.engine
      .getAccount(accountId, networkId)
      .then(($account) => {
        setAccount($account);
      });
  }, [accountId, networkId]);

  useEffect(() => {
    refreshWallet();
    refreshAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canExportPrivateKey = !!network?.settings?.privateKeyExportEnabled;
  const name = useWalletName({ wallet });
  return (
    <>
      <Modal
        header={account?.name}
        headerDescription={name}
        footer={null}
        scrollViewProps={{
          children: (
            <Box
              flexDirection="column"
              p={0.5}
              alignItems="center"
              mb={{ base: 4, md: 0 }}
            >
              <Typography.Subheading w="100%" color="text-subdued">
                {intl.formatMessage({ id: 'content__info' })}
              </Typography.Subheading>
              <Container.Box mt={2}>
                <Container.Item
                  hasArrow
                  title={intl.formatMessage({ id: 'form__name' })}
                  titleColor="text-default"
                  describe={account?.name}
                  describeColor="text-subdued"
                  onPress={() => {
                    setModifyNameAccount(account);
                    setModifyNameVisible(true);
                  }}
                />
              </Container.Box>

              <Typography.Subheading mt={6} w="100%" color="text-subdued">
                {intl.formatMessage({ id: 'form__security_uppercase' })}
              </Typography.Subheading>
              <Container.Box mt={2}>
                {(wallet?.type === 'hd' || wallet?.type === 'imported') && (
                  <Container.Item
                    hasArrow={canExportPrivateKey}
                    title={intl.formatMessage({
                      id: 'action__export_private_key',
                    })}
                    titleColor="text-default"
                    onPress={() => {
                      if (!canExportPrivateKey) {
                        toast.show({
                          title: intl.formatMessage({
                            id: 'badge__coming_soon',
                          }),
                        });
                        return;
                      }
                      navigation.navigate(RootRoutes.Modal, {
                        screen: ModalRoutes.ManagerAccount,
                        params: {
                          screen:
                            ManagerAccountModalRoutes.ManagerAccountExportPrivateModal,
                          params: {
                            accountId,
                            networkId,
                          },
                        },
                      });
                    }}
                  />
                )}
                <Container.Item
                  hasArrow
                  title={intl.formatMessage({ id: 'action__remove_account' })}
                  titleColor="text-critical"
                  onPress={() => {
                    if (wallet?.type === 'hw' || wallet?.type === 'watching') {
                      showRemoveAccountDialog(
                        walletId,
                        accountId,
                        undefined,
                        () => {
                          refreshAccounts?.();
                          if (navigation?.canGoBack?.()) navigation.goBack();
                        },
                      );
                      return;
                    }

                    showVerify(
                      (pwd) => {
                        showRemoveAccountDialog(
                          walletId,
                          accountId,
                          pwd,
                          () => {
                            refreshAccounts?.();
                            if (navigation?.canGoBack?.()) navigation.goBack();
                          },
                        );
                      },
                      () => {},
                      null,
                      ValidationFields.Account,
                    );
                  }}
                />
              </Container.Box>
            </Box>
          ),
        }}
      />
      {RemoveAccountDialog}
      <AccountModifyNameDialog
        visible={modifyNameVisible}
        account={modifyNameAccount}
        onClose={() => setModifyNameVisible(false)}
        onDone={() => {
          refreshAccount();
        }}
      />
    </>
  );
};

export default ManagerAccountModal;
