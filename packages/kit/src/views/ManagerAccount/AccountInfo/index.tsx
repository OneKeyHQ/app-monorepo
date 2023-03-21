import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Container,
  Modal,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
import type {
  Account,
  AccountCredential,
} from '@onekeyhq/engine/src/types/account';
import { AccountCredentialType } from '@onekeyhq/engine/src/types/account';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ManagerAccountRoutesParams } from '@onekeyhq/kit/src/routes/Modal/ManagerAccount';
import { ManagerAccountModalRoutes } from '@onekeyhq/kit/src/routes/Modal/ManagerAccount';

import { useWalletName } from '../../../hooks/useWalletName';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import AccountModifyNameDialog from '../ModifyAccount';
import useRemoveAccountDialog from '../RemoveAccount';

import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  ManagerAccountRoutesParams,
  ManagerAccountModalRoutes.ManagerAccountModal
>;

const ManagerAccountModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();

  const { goToRemoveAccount, RemoveAccountDialog } = useRemoveAccountDialog();
  const [modifyNameVisible, setModifyNameVisible] = useState(false);
  const [modifyNameAccount, setModifyNameAccount] = useState<Account>();
  const [credentialInfo, setCredentialInfo] = useState<AccountCredential[]>([]);
  const { walletId, accountId, networkId, refreshAccounts } =
    useRoute<RouteProps>().params;

  const { engine, serviceNetwork } = backgroundApiProxy;

  const [wallet, setWallet] = useState<Wallet>();
  const [account, setAccount] = useState<Account>();

  const refreshWallet = useCallback(() => {
    if (!walletId) return;

    engine.getWallet(walletId).then(($wallet) => {
      setWallet($wallet);
    });
  }, [engine, walletId]);

  const refreshAccount = useCallback(() => {
    if (!accountId || !networkId) return;

    engine
      .getAccount(accountId, networkId)
      .then(($account) => {
        setAccount($account);
      })
      .finally(() => {
        refreshAccounts?.();
      });
  }, [accountId, engine, networkId, refreshAccounts]);

  useEffect(() => {
    refreshWallet();
    refreshAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const network = await serviceNetwork.getNetworkWithRuntime(networkId);

      const exportCredentialInfo = network?.settings.exportCredentialInfo;
      const privateKeyExportEnabled = network?.settings.privateKeyExportEnabled;

      if (privateKeyExportEnabled) {
        if (exportCredentialInfo) {
          setCredentialInfo(exportCredentialInfo);
        } else {
          setCredentialInfo([
            {
              type: AccountCredentialType.PrivateKey,
              key: 'action__export_private_key',
            },
          ]);
        }
      }
    })();
  }, [networkId, serviceNetwork]);

  const name = useWalletName({ wallet });

  const credentialElements = useMemo(() => {
    if (credentialInfo && credentialInfo.length) {
      return credentialInfo.map((credential) => (
        <Container.Item
          key={credential.key}
          hasArrow
          title={intl.formatMessage({
            id: credential.key,
          })}
          titleColor="text-default"
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.ManagerAccount,
              params: {
                screen:
                  ManagerAccountModalRoutes.ManagerAccountExportPrivateModal,
                params: {
                  accountId,
                  networkId,
                  accountCredential: credential,
                },
              },
            });
          }}
        />
      ));
    }

    return (
      <Container.Item
        hasArrow={false}
        title={intl.formatMessage({
          id: 'action__export_private_key',
        })}
        titleColor="text-default"
        onPress={() =>
          ToastManager.show({
            title: intl.formatMessage({
              id: 'badge__coming_soon',
            }),
          })
        }
      />
    );
  }, [accountId, credentialInfo, intl, navigation, networkId]);

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
              <Container.Box
                mt={2}
                borderWidth={1}
                borderColor="border-subdued"
              >
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
              <Container.Box
                mt={2}
                borderWidth={1}
                borderColor="border-subdued"
              >
                {(wallet?.type === 'hd' || wallet?.type === 'imported') && (
                  <>{credentialElements}</>
                )}
                <Container.Item
                  hasArrow
                  title={intl.formatMessage({ id: 'action__remove_account' })}
                  titleColor="text-critical"
                  onPress={() => {
                    goToRemoveAccount({
                      wallet,
                      accountId,
                      networkId,
                      callback: () => {
                        refreshAccounts?.();
                        if (navigation?.canGoBack?.()) navigation.goBack();
                      },
                    });
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
