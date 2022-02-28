/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useDrawerStatus } from '@react-navigation/drawer';
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
} from '@onekeyhq/components';
// import MiniDeviceIcon from '@onekeyhq/components/img/deviceIcon_mini.png';
import type {
  Account as AccountEngineType,
  SimpleAccount,
} from '@onekeyhq/engine/src/types/account';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import engine from '@onekeyhq/kit/src/engine/EngineProvider';
import {
  useActiveWalletAccount,
  useAppDispatch,
  useAppSelector,
  useSettings,
} from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
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
import { changeActiveAccount } from '@onekeyhq/kit/src/store/reducers/general';

import LeftSide from './LeftSide';
import RightHeader from './RightHeader';

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams> &
  ModalScreenProps<ImportAccountRoutesParams> &
  ModalScreenProps<WatchedAccountRoutesParams>;

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

const AccountSelectorChildren: FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const status = useDrawerStatus();
  const isOpen = status === 'open';
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { activeNetwork } = useAppSelector((s) => s.general);

  const { account: currentSelectedAccount, wallet: defaultSelectedWallet } =
    useActiveWalletAccount();
  const wallets = useAppSelector((s) => s.wallet.wallets);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(
    defaultSelectedWallet,
  );

  const [activeAccounts, setActiveAccounts] = useState<AccountEngineType[]>([]);
  const handleChange = useCallback(() => {
    // TODO:
  }, []);

  function renderSideAction(
    type: AccountType | undefined,
    onChange: (v: string) => void,
  ) {
    if (type === 'hd') {
      return (
        <Select
          dropdownPosition="left"
          onChange={onChange}
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
    }

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

    if (type === 'imported') {
      return (
        <IconButton
          name="PlusSolid"
          type="plain"
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.ImportAccount,
              params: {
                screen: ImportAccountModalRoutes.ImportAccountModal,
              },
            });
          }}
        />
      );
    }
  }

  useEffect(() => {
    if (isOpen) {
      setSelectedWallet(defaultSelectedWallet);
    }
  }, [isOpen, defaultSelectedWallet]);

  const activeWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === selectedWallet?.id) ?? null,
    [selectedWallet?.id, wallets],
  );

  useEffect(() => {
    async function main() {
      if (!activeWallet) return;
      const accounts = await engine.getAccounts(
        activeWallet.accounts,
        activeNetwork?.network?.id,
      );

      setActiveAccounts(accounts);
    }
    main();
  }, [activeWallet, activeNetwork, wallets]);

  return (
    <>
      <LeftSide
        selectedWallet={selectedWallet}
        setSelectedWallet={setSelectedWallet}
      />
      <VStack flex={1}>
        <RightHeader selectedWallet={selectedWallet} />
        <FlatList
          px={2}
          contentContainerStyle={{
            paddingBottom: 16,
          }}
          zIndex={2}
          data={activeAccounts}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item }) => (
            <Pressable
              zIndex={99}
              onPress={() => {
                dispatch(
                  // backgroundApiProxy.changeAccounts(item.address);
                  changeActiveAccount({
                    account: item,
                    wallet: activeWallet,
                  }),
                );
                setTimeout(() => {
                  navigation.dispatch(DrawerActions.closeDrawer());
                }, 10);
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
                >
                  <Box flex={1}>
                    <Account
                      address={(item as SimpleAccount)?.address ?? ''}
                      name={item.name}
                    />
                  </Box>
                  {renderSideAction(selectedWallet?.type, handleChange)}
                </HStack>
              )}
            </Pressable>
          )}
          ListFooterComponent={
            <Pressable
              mt={2}
              onPress={() => {
                if (!selectedWallet) return;
                if (selectedWallet?.type === 'imported') {
                  return navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.ImportAccount,
                    params: {
                      screen: ImportAccountModalRoutes.ImportAccountModal,
                    },
                  });
                }
                if (selectedWallet?.type === 'watching') {
                  return navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.WatchedAccount,
                    params: {
                      screen: WatchedAccountModalRoutes.WatchedAccountModal,
                    },
                  });
                }

                return navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.CreateAccount,
                  params: {
                    screen: CreateAccountModalRoutes.CreateAccountForm,
                    params: {
                      walletId: selectedWallet.id,
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
    </>
  );
};

export default AccountSelectorChildren;
