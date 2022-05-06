import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { DrawerActions } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Account,
  Box,
  FlatList,
  HStack,
  Icon,
  Pressable,
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
  useRuntime,
} from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateAccountModalRoutes,
  CreateWalletModalRoutes,
} from '@onekeyhq/kit/src/routes';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import { setHaptics } from '../../../hooks/setHaptics';
import useAppNavigation from '../../../hooks/useAppNavigation';
import useLocalAuthenticationModal from '../../../hooks/useLocalAuthenticationModal';
import { ManagerAccountModalRoutes } from '../../../routes/Modal/ManagerAccount';
import AccountModifyNameDialog from '../../../views/ManagerAccount/ModifyAccount';
import useRemoveAccountDialog from '../../../views/ManagerAccount/RemoveAccount';
import { ValidationFields } from '../../Protected';

import LeftSide from './LeftSide';
import RightHeader from './RightHeader';

export type AccountType = 'hd' | 'hw' | 'imported' | 'watching';

type CustomSelectTriggerProps = {
  isSelectVisible?: boolean;
  isTriggerHovered?: boolean;
  isTriggerPressed?: boolean;
};

const CustomSelectTrigger: FC<CustomSelectTriggerProps> = ({
  isSelectVisible,
  isTriggerHovered,
  isTriggerPressed,
}) => (
  <Box
    p={2}
    borderRadius="xl"
    bg={
      // eslint-disable-next-line no-nested-ternary
      isSelectVisible
        ? 'surface-selected'
        : // eslint-disable-next-line no-nested-ternary
        isTriggerPressed
        ? 'surface-pressed'
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
  const navigation = useAppNavigation();

  const { bottom } = useSafeAreaInsets();
  const { showVerify } = useLocalAuthenticationModal();
  const { show: showRemoveAccountDialog, RemoveAccountDialog } =
    useRemoveAccountDialog();

  const [modifyNameVisible, setModifyNameVisible] = useState(false);
  const [modifyNameAccount, setModifyNameAccount] =
    useState<AccountEngineType>();

  const {
    account: currentSelectedAccount,
    wallet: defaultSelectedWallet,
    network: activeNetwork,
  } = useActiveWalletAccount();
  const { wallets } = useRuntime();
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

  const refreshAccounts = useCallback(async () => {
    if (!activeWallet) return;
    const accounts = await backgroundApiProxy.engine.getAccounts(
      activeWallet.accounts,
      activeNetwork?.id,
    );

    setActiveAccounts(accounts);
  }, [activeNetwork?.id, activeWallet]);

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
                networkId: activeNetwork?.id ?? '',
                refreshAccounts,
              },
            },
          });
          break;
        case 'remove':
          if (selectedWallet?.type === 'watching') {
            showRemoveAccountDialog(
              selectedWallet?.id ?? '',
              item.id,
              undefined,
              () => {
                refreshAccounts();
              },
            );
          } else {
            showVerify(
              (pwd) => {
                showRemoveAccountDialog(
                  selectedWallet?.id ?? '',
                  item.id,
                  pwd,
                  () => {
                    refreshAccounts();
                  },
                );
              },
              () => {},
              null,
              ValidationFields.Account,
            );
          }
          break;

        default:
          break;
      }
    },
    [
      activeNetwork?.id,
      navigation,
      refreshAccounts,
      selectedWallet?.id,
      selectedWallet?.type,
      showRemoveAccountDialog,
      showVerify,
    ],
  );

  function renderSideAction(
    type: AccountType | undefined,
    onChange: (v: string) => void,
  ) {
    return (
      <Select
        dropdownPosition="right"
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
            isTriggerPressed={visible}
          />
        )}
      />
    );
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
                setHaptics();
                backgroundApiProxy.serviceAccount.changeActiveAccount({
                  accountId: item.id,
                  walletId: activeWallet?.id ?? '',
                });
                setTimeout(() => {
                  navigation.dispatch(DrawerActions.closeDrawer());
                }, 0);
              }}
            >
              {({ isHovered, isPressed }) => (
                <HStack
                  p="7px"
                  borderWidth={1}
                  borderColor={isHovered ? 'border-hovered' : 'transparent'}
                  bg={
                    // eslint-disable-next-line no-nested-ternary
                    isPressed
                      ? 'surface-pressed'
                      : currentSelectedAccount?.id === item.id
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
          ItemSeparatorComponent={() => <Box h={2} />}
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
              {({ isHovered, isPressed }) => (
                <HStack
                  p={2}
                  borderRadius="xl"
                  space={3}
                  borderWidth={1}
                  borderColor={isHovered ? 'border-hovered' : 'border-subdued'}
                  bgColor={isPressed ? 'surface-pressed' : undefined}
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
        onDone={() => {
          refreshAccounts();
        }}
      />
    </>
  );
};

export default AccountSelectorChildren;
