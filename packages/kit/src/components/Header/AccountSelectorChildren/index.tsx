/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { DrawerActions } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Account,
  Box,
  FlatList,
  HStack,
  Icon,
  IconButton,
  Pressable,
  ScrollView,
  Select,
  Typography,
  VStack,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
// import MiniDeviceIcon from '@onekeyhq/components/img/deviceIcon_mini.png';
import type { Account as AccountEngineType } from '@onekeyhq/engine/src/types/account';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useSettings,
} from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
  ImportAccountModalRoutes,
  ImportAccountRoutesParams,
  WatchedAccountModalRoutes,
  WatchedAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import useAppNavigation from '../../../hooks/useAppNavigation';
import useLocalAuthenticationModal from '../../../hooks/useLocalAuthenticationModal';
import { ManagerAccountModalRoutes } from '../../../routes/Modal/ManagerAccount';
import AccountModifyNameDialog from '../../../views/ManagerAccount/ModifyAccount';
import useRemoveAccountDialog from '../../../views/ManagerAccount/RemoveAccount';

import LeftSide from './LeftSide';
import RightHeader from './RightHeader';

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams> &
  ModalScreenProps<ImportAccountRoutesParams> &
  ModalScreenProps<WatchedAccountRoutesParams> &
  ModalScreenProps<CreateWalletRoutesParams>;

export type AccountType = 'hd' | 'hw' | 'imported' | 'watching';

type CustomSelectTriggerProps = {
  isSelectVisible?: boolean;
  isTriggerHovered?: boolean;
};

const CustomSelectTrigger: FC<CustomSelectTriggerProps> = ({
  isSelectVisible,
  isTriggerHovered,
}) => (
  <Box
    p={2}
    borderRadius="xl"
    bg={
      // eslint-disable-next-line no-nested-ternary
      isSelectVisible
        ? 'surface-selected'
        : isTriggerHovered
        ? 'surface-hovered'
        : 'transparent'
    }
  >
    <Icon size={20} name="DotsHorizontalSolid" />
  </Box>
);

const AccountSelectorChildren: FC<{ isOpen?: boolean }> = ({ isOpen }) => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const { bottom } = useSafeAreaInsets();
  // const navigation = useNavigation<NavigationProps['navigation']>();
  const navigation = useAppNavigation();
  const { activeNetwork } = useAppSelector((s) => s.general);
  const { showVerify } = useLocalAuthenticationModal();
  const { show: showRemoveAccountDialog, RemoveAccountDialog } =
    useRemoveAccountDialog();

  const [modifyNameVisible, setModifyNameVisible] = useState(false);
  const [modifyNameAccount, setModifyNameAccount] =
    useState<AccountEngineType>();

  const { account: currentSelectedAccount, wallet: defaultSelectedWallet } =
    useActiveWalletAccount();
  const wallets = useAppSelector((s) => s.wallet.wallets);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(
    defaultSelectedWallet,
  );

  const [activeAccounts, setActiveAccounts] = useState<AccountEngineType[]>([]);

  const activeWallet = useMemo(() => {
    const wallet =
      wallets.find((_wallet) => _wallet.id === selectedWallet?.id) ?? null;
    if (!wallet) setSelectedWallet(defaultSelectedWallet);
    return wallet;
  }, [defaultSelectedWallet, selectedWallet?.id, wallets]);

  const refreshAccounts = useCallback(() => {
    async function main() {
      if (!activeWallet) return;
      const accounts = await backgroundApiProxy.engine.getAccounts(
        activeWallet.accounts,
        activeNetwork?.network?.id,
      );

      setActiveAccounts(accounts);
    }
    return main();
  }, [activeNetwork?.network?.id, activeWallet]);

  const handleChange = useCallback(
    (item: AccountEngineType, value) => {
      switch (value) {
        case 'rename':
          setModifyNameAccount(item);
          setModifyNameVisible(true);

          break;
        case 'detail':
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.ManagerAccount,
            params: {
              screen: ManagerAccountModalRoutes.ManagerAccountModal,
              params: {
                walletId: selectedWallet?.id ?? '',
                accountId: item.id,
                networkId: activeNetwork?.network.id ?? '',
              },
            },
          });
          break;
        case 'remove':
          showVerify(
            (pwd) => {
              showRemoveAccountDialog(
                selectedWallet?.id ?? '',
                item.id,
                pwd,
                () => {
                  refreshAccounts();
                  console.log('remove account', item.id);
                },
              );
            },
            () => {},
          );
          break;

        default:
          break;
      }
    },
    [
      activeNetwork?.network.id,
      navigation,
      refreshAccounts,
      selectedWallet?.id,
      showRemoveAccountDialog,
      showVerify,
    ],
  );

  function renderSideAction(
    type: AccountType | undefined,
    onChange: (v: string) => void,
  ) {
    // if (type === 'hd') {
    return (
      <Select
        dropdownPosition="left"
        onChange={(v) => onChange(v)}
        activatable={false}
        options={[
          {
            label: intl.formatMessage({ id: 'action__rename' }),
            value: 'rename',
            iconProps: {
              name: isVerticalLayout ? 'TagOutline' : 'TagSolid',
            },
          },
          {
            label: intl.formatMessage({ id: 'action__view_details' }),
            value: 'detail',
            iconProps: {
              name: isVerticalLayout
                ? 'DocumentTextOutline'
                : 'DocumentTextSolid',
            },
          },
          {
            label: intl.formatMessage({ id: 'action__remove_account' }),
            value: 'remove',
            iconProps: {
              name: isVerticalLayout ? 'TrashOutline' : 'TrashSolid',
            },
            destructive: true,
          },
        ]}
        headerShown={false}
        footer={null}
        containerProps={{ width: 'auto' }}
        dropdownProps={{
          width: 248,
        }}
        renderTrigger={(activeOption, isHovered, visible) => (
          <CustomSelectTrigger
            isTriggerHovered={isHovered}
            isSelectVisible={visible}
          />
        )}
      />
    );
    // }

    // if (type === 'watching') {
    //   return (
    //     <IconButton
    //       name="PlusSolid"
    //       type="plain"
    //       onPress={() => {
    //         navigation.navigate(RootRoutes.Modal, {
    //           screen: ModalRoutes.CreateAccount,
    //           params: {
    //             screen: CreateAccountModalRoutes.CreateAccountForm,
    //           },
    //         });
    //       }}
    //     />
    //   );
    // }

    // if (type === 'imported') {
    //   return (
    //     <IconButton
    //       name="PlusSolid"
    //       type="plain"
    //       onPress={() => {
    //         navigation.navigate(RootRoutes.Modal, {
    //           screen: ModalRoutes.ImportAccount,
    //           params: {
    //             screen: ImportAccountModalRoutes.ImportAccountModal,
    //           },
    //         });
    //       }}
    //     />
    //   );
    // }
  }

  useEffect(() => {
    if (isOpen) {
      setSelectedWallet(defaultSelectedWallet);
    }
  }, [isOpen, defaultSelectedWallet]);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  return (
    <>
      <LeftSide
        selectedWallet={activeWallet}
        setSelectedWallet={setSelectedWallet}
      />
      <VStack flex={1} pb={bottom}>
        <RightHeader selectedWallet={activeWallet} />
        <FlatList
          px={2}
          contentContainerStyle={{
            paddingBottom: 16,
          }}
          data={activeAccounts}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                backgroundApiProxy.serviceAccount.changeActiveAccount({
                  account: item,
                  wallet: activeWallet,
                });
                setTimeout(() => {
                  navigation.dispatch(DrawerActions.closeDrawer());
                });
              }}
            >
              {({ isHovered }) => (
                <HStack
                  p="7px"
                  borderWidth={1}
                  borderColor={isHovered ? 'border-hovered' : 'transparent'}
                  bg={
                    currentSelectedAccount?.id === item.id
                      ? 'surface-selected'
                      : 'transparent'
                  }
                  space={4}
                  borderRadius="xl"
                  alignItems="center"
                >
                  <Box flex={1}>
                    <Account
                      hiddenAvatar
                      address={item?.address ?? ''}
                      name={item.name}
                    />
                  </Box>
                  {renderSideAction(activeWallet?.type, (v) =>
                    handleChange(item, v),
                  )}
                </HStack>
              )}
            </Pressable>
          )}
          ListFooterComponent={
            <Pressable
              mt={2}
              onPress={() => {
                if (!activeWallet) return;
                if (activeWallet?.type === 'imported') {
                  return navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.CreateWallet,
                    params: {
                      screen: CreateWalletModalRoutes.AddExistingWalletModal,
                      params: { mode: 'privatekey' },
                    },
                  });
                }
                if (activeWallet?.type === 'watching') {
                  return navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.CreateWallet,
                    params: {
                      screen: CreateWalletModalRoutes.AddExistingWalletModal,
                      params: { mode: 'address' },
                    },
                  });
                }

                return navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.CreateAccount,
                  params: {
                    screen: CreateAccountModalRoutes.CreateAccountForm,
                    params: {
                      walletId: activeWallet.id,
                    },
                  },
                });
              }}
            >
              {({ isHovered }) => (
                <HStack
                  p={2}
                  borderRadius="xl"
                  space={3}
                  borderWidth={1}
                  borderColor={isHovered ? 'border-hovered' : 'border-subdued'}
                  borderStyle="dashed"
                  alignItems="center"
                >
                  <Icon name="PlusCircleOutline" />
                  <Typography.Body2Strong color="text-subdued">
                    {intl.formatMessage({ id: 'action__add_account' })}
                  </Typography.Body2Strong>
                </HStack>
              )}
            </Pressable>
          }
        />
      </VStack>
      {RemoveAccountDialog}
      <AccountModifyNameDialog
        visible={modifyNameVisible}
        account={modifyNameAccount}
        onClose={() => setModifyNameVisible(false)}
        onDone={(account) => {
          refreshAccounts();
          console.log('account modify name', account.id);
        }}
      />
    </>
  );
};

export default AccountSelectorChildren;
