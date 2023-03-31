/* eslint-disable no-nested-ternary */
import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Alert,
  Box,
  Container,
  Icon,
  ListItem,
  Modal,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import { formatMessage } from '@onekeyhq/components/src/Provider';
import type { SectionListProps } from '@onekeyhq/components/src/SectionList';
import type {
  Account,
  AccountCredential,
} from '@onekeyhq/engine/src/types/account';
import { AccountCredentialType } from '@onekeyhq/engine/src/types/account';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ManagerAccountRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/ManagerAccount';
import { ManagerAccountModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';

import { useNetwork } from '../../../hooks';
import { useWalletName } from '../../../hooks/useWalletName';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import AccountModifyNameDialog from '../ModifyAccount';
import useRemoveAccountDialog from '../RemoveAccount';

import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  ManagerAccountRoutesParams,
  ManagerAccountModalRoutes.ManagerAccountModal
>;

type IAccountInfoListItem = {
  key: ManageAccountKeys;
  label?: string;
  description?: string;
  credentialInfo?: AccountCredential;
};

type IAccountInfoListSectionData = {
  title: string;
  data: IAccountInfoListItem[];
};

enum ManageAccountKeys {
  Name = 'Name',
  ExportPublicKey = 'ExportPublicKey',
  ExportPrivateKey = 'ExportPrivateKey',
  ExportSecretMnemonic = 'ExportSecretMnemonic',
  ExportPrivateViewKey = 'ExportPrivateViewKey',
  ExportPrivateSpendKey = 'ExportPrivateSpendKey',
  HardwareCanNotExportPrivateKey = 'HardwareCanNotExportPrivateKey',
  RemoveAccount = 'RemoveAccount',
}

const SpecialExportCredentialKeys = [
  ManageAccountKeys.ExportPrivateSpendKey,
  ManageAccountKeys.ExportPrivateViewKey,
  ManageAccountKeys.ExportSecretMnemonic,
];

const manageAccountOptions: Record<ManageAccountKeys, IAccountInfoListItem> = {
  [ManageAccountKeys.Name]: {
    label: formatMessage({ id: 'form__name' }),
    key: ManageAccountKeys.Name,
  },
  [ManageAccountKeys.ExportPublicKey]: {
    label: formatMessage({ id: 'form__export_public_key' }),
    key: ManageAccountKeys.ExportPublicKey,
    description: formatMessage({
      id: 'msg__once_exposed_a_third_party_will_be_able_to_see_your_entire_transaction_history',
    }),
  },
  [ManageAccountKeys.HardwareCanNotExportPrivateKey]: {
    key: ManageAccountKeys.HardwareCanNotExportPrivateKey,
  },
  [ManageAccountKeys.ExportPrivateKey]: {
    label: formatMessage({ id: 'action__export_private_key' }),
    key: ManageAccountKeys.ExportPrivateKey,
    description: formatMessage({
      id: 'msg__once_exposed_a_third_party_will_be_able_to_take_full_control_of_your_account',
    }),
    credentialInfo: {
      type: AccountCredentialType.PrivateKey,
      key: 'action__export_private_key',
    },
  },
  [ManageAccountKeys.ExportPrivateViewKey]: {
    label: formatMessage({ id: 'action__export_view_key' }),
    key: ManageAccountKeys.ExportPrivateViewKey,
    credentialInfo: {
      type: AccountCredentialType.PrivateViewKey,
      key: 'action__export_view_key',
    },
  },
  [ManageAccountKeys.ExportPrivateSpendKey]: {
    label: formatMessage({ id: 'action__export_spend_key' }),
    key: ManageAccountKeys.ExportPrivateSpendKey,
    credentialInfo: {
      type: AccountCredentialType.PrivateSpendKey,
      key: 'action__export_spend_key',
    },
  },
  [ManageAccountKeys.ExportSecretMnemonic]: {
    label: formatMessage({ id: 'action__export_secret_mnemonic' }),
    description: formatMessage({
      id: 'msg__once_exposed_a_third_party_will_be_able_to_take_full_control_of_your_account',
    }),
    key: ManageAccountKeys.ExportSecretMnemonic,
    credentialInfo: {
      type: AccountCredentialType.Mnemonic,
      key: 'action__export_secret_mnemonic',
    },
  },
  [ManageAccountKeys.RemoveAccount]: {
    label: formatMessage({ id: 'action__remove_account' }),
    key: ManageAccountKeys.RemoveAccount,
  },
};

const ExportKeyListItem: FC<{
  item: IAccountInfoListItem;
  onPress: (item: IAccountInfoListItem) => void;
}> = ({ item }) => (
  <ListItem
    onPress={() => {}}
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

function useManageDataSource({
  wallet,
  networkId,
}: {
  wallet?: Wallet;
  networkId: string;
}) {
  const intl = useIntl();
  const { network } = useNetwork({ networkId });
  const [dataSource, setDataSource] = useState<IAccountInfoListSectionData[]>([
    {
      title: intl.formatMessage({ id: 'content__info' }),
      data: [manageAccountOptions[ManageAccountKeys.Name]],
    },
  ]);

  useEffect(() => {
    const keys: ManageAccountKeys[] = [];
    if (network && wallet) {
      const {
        exportCredentialInfo,
        privateKeyExportEnabled,
        publicKeyExportEnabled,
      } = network.settings;
      if (publicKeyExportEnabled) {
        keys.push(ManageAccountKeys.ExportPublicKey);
      }
      if (
        privateKeyExportEnabled &&
        (wallet.type === 'hd' || wallet.type === 'imported')
      ) {
        if (exportCredentialInfo) {
          SpecialExportCredentialKeys.forEach((key) => {
            const option = manageAccountOptions[key];
            if (
              exportCredentialInfo.some(
                (info) => info.type === option.credentialInfo?.type,
              )
            ) {
              keys.push(key);
            }
          });
        } else {
          keys.push(ManageAccountKeys.ExportPrivateKey);
        }
      }
      if (wallet.type === 'hw') {
        keys.push(ManageAccountKeys.HardwareCanNotExportPrivateKey);
      }
      keys.push(ManageAccountKeys.RemoveAccount);
      setDataSource((prev) => [
        ...prev,
        {
          title: intl.formatMessage({ id: 'form__security_uppercase' }),
          data: keys.map((key) => manageAccountOptions[key]),
        },
      ]);
    }
  }, [network, wallet, intl]);

  // const dataSource: IAccountInfoListSectionData[] = [
  //   {
  //     title: intl.formatMessage({ id: 'content__info' }),
  //     data: [
  //       {
  //         label: intl.formatMessage({ id: 'form__name' }),
  //         key: ManageAccountKeys.Name,
  //       },
  //     ],
  //   },
  //   {
  //     title: intl.formatMessage({ id: 'form__security_uppercase' }),
  //     data: [
  //       {
  //         label: intl.formatMessage({ id: 'form__export_public_key' }),
  //         key: ManageAccountKeys.ExportPublicKey,
  //         description: intl.formatMessage({
  //           id: 'msg__once_exposed_a_third_party_will_be_able_to_see_your_entire_transaction_history',
  //         }),
  //       },
  //       {
  //         key: ManageAccountKeys.HardwareCanNotExportPrivateKey,
  //       },
  //       {
  //         label: intl.formatMessage({ id: 'action__export_private_key' }),
  //         key: ManageAccountKeys.ExportPrivateKey,
  //         description: intl.formatMessage({
  //           id: 'msg__once_exposed_a_third_party_will_be_able_to_take_full_control_of_your_account',
  //         }),
  //       },
  //       {
  //         label: intl.formatMessage({ id: 'action__export_view_key' }),
  //         key: ManageAccountKeys.ExportPrivateViewKey,
  //       },
  //       {
  //         label: intl.formatMessage({ id: 'action__export_spend_key' }),
  //         key: ManageAccountKeys.ExportPrivateSpendKey,
  //       },
  //       {
  //         label: intl.formatMessage({ id: 'action__export_secret_mnemonic' }),
  //         description: intl.formatMessage({
  //           id: 'msg__once_exposed_a_third_party_will_be_able_to_take_full_control_of_your_account',
  //         }),
  //         key: ManageAccountKeys.ExportSecretMnemonic,
  //       },
  //       {
  //         label: intl.formatMessage({ id: 'action__remove_account' }),
  //         key: ManageAccountKeys.RemoveAccount,
  //       },
  //     ],
  //   },
  // ];
  return { dataSource };
}

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

  const { dataSource } = useManageDataSource({ networkId, wallet });
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
        case ManageAccountKeys.ExportPrivateViewKey: {
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
          console.log('xpub');
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
            ManageAccountKeys.ExportPrivateViewKey,
            ManageAccountKeys.ExportPrivateSpendKey,
            ManageAccountKeys.ExportSecretMnemonic,
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
        // scrollViewProps={{
        //   children: (
        //     <Box
        //       flexDirection="column"
        //       p={0.5}
        //       alignItems="center"
        //       mb={{ base: 4, md: 0 }}
        //     >
        //       <Typography.Subheading w="100%" color="text-subdued">
        //         {intl.formatMessage({ id: 'content__info' })}
        //       </Typography.Subheading>
        //       <Container.Box
        //         mt={2}
        //         borderWidth={1}
        //         borderColor="border-subdued"
        //       >
        //         <Container.Item
        //           hasArrow
        //           title={intl.formatMessage({ id: 'form__name' })}
        //           titleColor="text-default"
        //           describe={account?.name}
        //           describeColor="text-subdued"
        //           onPress={() => {
        //             setModifyNameAccount(account);
        //             setModifyNameVisible(true);
        //           }}
        //         />
        //       </Container.Box>

        //       <Typography.Subheading mt={6} w="100%" color="text-subdued">
        //         {intl.formatMessage({ id: 'form__security_uppercase' })}
        //       </Typography.Subheading>
        //       <Container.Box
        //         mt={2}
        //         borderWidth={1}
        //         borderColor="border-subdued"
        //       >
        //         {(wallet?.type === 'hd' || wallet?.type === 'imported') && (
        //           <>{credentialElements}</>
        //         )}
        //         <Container.Item
        //           hasArrow
        //           title={intl.formatMessage({ id: 'action__remove_account' })}
        //           titleColor="text-critical"
        //           onPress={() => {
        //             goToRemoveAccount({
        //               wallet,
        //               accountId,
        //               networkId,
        //               callback: () => {
        //                 refreshAccounts?.();
        //                 if (navigation?.canGoBack?.()) navigation.goBack();
        //               },
        //             });
        //           }}
        //         />
        //       </Container.Box>
        //     </Box>
        //   ),
        // }}
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
