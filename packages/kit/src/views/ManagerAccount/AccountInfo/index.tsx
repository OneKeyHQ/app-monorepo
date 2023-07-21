/* eslint-disable no-nested-ternary */
import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Alert, Box, Icon, ListItem, Modal, Text } from '@onekeyhq/components';
import type { SectionListProps } from '@onekeyhq/components/src/SectionList';
import type {
  Account,
  AccountCredential,
} from '@onekeyhq/engine/src/types/account';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ManagerAccountRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/ManagerAccount';
import { ManagerAccountModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';

import { useWalletName } from '../../../hooks/useWalletName';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import AccountModifyNameDialog from '../ModifyAccount';
import useRemoveAccountDialog from '../RemoveAccount';

import {
  ManageAccountKeys,
  SpecialExportCredentialKeys,
} from './accountInfoConstants';
import { useAccountInfoDataSource } from './useAccountInfoDataSource';

import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  ManagerAccountRoutesParams,
  ManagerAccountModalRoutes.ManagerAccountModal
>;

export type IAccountInfoListItem = {
  key: ManageAccountKeys;
  label?: string;
  description?: string;
  credentialInfo?: AccountCredential;
};

export type IAccountInfoListSectionData = {
  title: string;
  data: IAccountInfoListItem[];
};

const ExportKeyListItem: FC<{
  item: IAccountInfoListItem;
  onPress: (item: IAccountInfoListItem) => void;
}> = ({ item, onPress }) => (
  <ListItem
    onPress={() => onPress(item)}
    mx={-2}
    my={1.5}
    flexDirection="column"
    alignItems="flex-start"
  >
    <Text typography="Body1Strong" color="text-default">
      {item.label}
    </Text>
    <Text typography="Body2" color="text-subdued">
      {item.description}
    </Text>
  </ListItem>
);

const ManagerAccountModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();

  const { goToRemoveAccount, RemoveAccountDialog } = useRemoveAccountDialog();
  const [modifyNameVisible, setModifyNameVisible] = useState(false);
  const [modifyNameAccount, setModifyNameAccount] = useState<Account>();
  const { walletId, accountId, networkId, refreshAccounts } =
    useRoute<RouteProps>().params;

  const { engine } = backgroundApiProxy;

  const [wallet, setWallet] = useState<Wallet>();
  const [account, setAccount] = useState<Account>();

  const { dataSource } = useAccountInfoDataSource({
    networkId,
    wallet,
    accountId,
  });
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

  const name = useWalletName({ wallet });

  const onPress = useCallback(
    (item: IAccountInfoListItem) => {
      switch (item.key) {
        case ManageAccountKeys.Name: {
          setModifyNameAccount(account);
          setModifyNameVisible(true);
          return;
        }
        case ManageAccountKeys.ExportPrivateKey:
        case ManageAccountKeys.ExportPrivateSpendKey:
        case ManageAccountKeys.ExportPrivateViewKey:
        case ManageAccountKeys.ExportSecretMnemonic: {
          if (item.credentialInfo) {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.ManagerAccount,
              params: {
                screen:
                  ManagerAccountModalRoutes.ManagerAccountExportPrivateModal,
                params: {
                  accountId,
                  networkId,
                  accountCredential: item.credentialInfo,
                },
              },
            });
          }
          return;
        }
        case ManageAccountKeys.ExportPublicKey: {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.ManagerAccount,
            params: {
              screen: ManagerAccountModalRoutes.ManagerAccountExportPublicModal,
              params: {
                walletId,
                accountId,
                networkId,
              },
            },
          });
          return;
        }

        case ManageAccountKeys.RemoveAccount: {
          goToRemoveAccount({
            wallet,
            accountId,
            networkId,
            callback: () => {
              refreshAccounts?.();
              if (navigation?.canGoBack?.()) navigation.goBack();
            },
          });
          break;
        }

        default:
          break;
      }
    },
    [
      account,
      accountId,
      walletId,
      goToRemoveAccount,
      navigation,
      networkId,
      refreshAccounts,
      wallet,
    ],
  );

  const sectionListProps = useMemo<SectionListProps<any>>(
    () => ({
      sections: dataSource,
      // @ts-expect-error
      renderSectionHeader: ({
        section,
      }: {
        section: IAccountInfoListSectionData;
      }) => (
        <Text
          typography={{ sm: 'Subheading', md: 'Subheading' }}
          color="text-subdued"
        >
          {section.title}
        </Text>
      ),
      renderItem: ({ item }: { item: IAccountInfoListItem }) => {
        if (item.key === ManageAccountKeys.Name) {
          return (
            <ListItem
              onPress={() => onPress(item)}
              mx={-2}
              my={1.5}
              alignItems="center"
              justifyContent="space-between"
            >
              <Text typography="Body1Strong">{item.label}</Text>
              <Box alignItems="center" flexDirection="row">
                <Text typography="Body1Strong" color="text-subdued">
                  {account?.name}
                </Text>
                <Icon name="ChevronRightMini" color="icon-subdued" size={15} />
              </Box>
            </ListItem>
          );
        }
        if (
          [
            ManageAccountKeys.ExportPublicKey,
            ManageAccountKeys.ExportPrivateKey,
            ...SpecialExportCredentialKeys,
          ].includes(item.key)
        ) {
          return (
            <ExportKeyListItem item={item} onPress={() => onPress(item)} />
          );
        }
        if (item.key === ManageAccountKeys.HardwareCanNotExportPrivateKey) {
          return (
            <Alert
              title={intl.formatMessage({
                id: 'msg__for_the_security_of_your_assets_the_hardware_wallet_firmware_restricts_the_private_key_from_being_exported',
              })}
              dismiss={false}
              alertType="info"
              customIconName="InformationCircleMini"
            />
          );
        }
        if (item.key === ManageAccountKeys.RemoveAccount) {
          return (
            <ListItem onPress={() => onPress(item)} mx={-2} my={1.5}>
              <Text typography="Body1Strong" color="text-critical">
                {item.label}
              </Text>
            </ListItem>
          );
        }
        return null;
      },
      renderSectionFooter: () => <Box h={5} />,
    }),
    [dataSource, account, intl, onPress],
  );

  return (
    <>
      <Modal
        header={account?.name}
        headerDescription={name}
        footer={null}
        sectionListProps={sectionListProps}
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
