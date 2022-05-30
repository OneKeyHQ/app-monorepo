import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { DrawerActions } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { SectionList } from 'react-native';

import {
  Account,
  Box,
  DialogManager,
  HStack,
  Icon,
  Pressable,
  Select,
  Text,
  Token,
  Typography,
  VStack,
  useIsVerticalLayout,
  useSafeAreaInsets,
  useToast,
} from '@onekeyhq/components';
import { SelectItem } from '@onekeyhq/components/src/Select';
import type { Account as AccountEngineType } from '@onekeyhq/engine/src/types/account';
import { Network } from '@onekeyhq/engine/src/types/network';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ValidationFields } from '@onekeyhq/kit/src/components/Protected';
import {
  useActiveWalletAccount,
  useRuntime,
} from '@onekeyhq/kit/src/hooks/redux';
import { setHaptics } from '@onekeyhq/kit/src/hooks/setHaptics';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useLocalAuthenticationModal from '@onekeyhq/kit/src/hooks/useLocalAuthenticationModal';
import {
  CreateAccountModalRoutes,
  CreateWalletModalRoutes,
  ManageNetworkRoutes,
} from '@onekeyhq/kit/src/routes';
import { ManagerAccountModalRoutes } from '@onekeyhq/kit/src/routes/Modal/ManagerAccount';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import AccountModifyNameDialog from '@onekeyhq/kit/src/views/ManagerAccount/ModifyAccount';
import useRemoveAccountDialog from '@onekeyhq/kit/src/views/ManagerAccount/RemoveAccount';

import { useManageNetworks } from '../../../hooks';
import { NetworkIcon } from '../../../views/ManageNetworks/Listing/NetworkIcon';

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

type AccountGroup = { title: Network; data: AccountEngineType[] };

const AllNetwork = 'all';

const AccountSelectorChildren: FC<{
  isOpen?: boolean;
  toggleOpen?: (...args: any) => any;
}> = ({ isOpen }) => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();

  const navigation = useAppNavigation();
  const toast = useToast();
  const { bottom } = useSafeAreaInsets();
  const { showVerify } = useLocalAuthenticationModal();
  const { show: showRemoveAccountDialog, RemoveAccountDialog } =
    useRemoveAccountDialog();

  const { engine, serviceAccount, serviceNetwork } = backgroundApiProxy;

  const {
    account: currentSelectedAccount,
    wallet: defaultSelectedWallet,
    network: activeNetwork,
  } = useActiveWalletAccount();
  const { wallets } = useRuntime();
  const { enabledNetworks } = useManageNetworks();
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(
    defaultSelectedWallet,
  );

  const [activeAccounts, setActiveAccounts] = useState<AccountGroup[]>([]);
  const [selectedNetworkId, setSelectedNetworkId] = useState<string>(
    activeNetwork?.id ?? AllNetwork,
  );

  const activeWallet = useMemo(() => {
    const wallet =
      wallets.find((_wallet) => _wallet.id === selectedWallet?.id) ?? null;
    if (!wallet) setSelectedWallet(defaultSelectedWallet);
    return wallet;
  }, [defaultSelectedWallet, selectedWallet?.id, wallets]);

  const refreshAccounts = useCallback(async () => {
    if (!activeWallet) {
      setActiveAccounts([]);
      return;
    }

    const networksMap = new Map(
      (await engine.listNetworks()).map((key) => [key.id, key]),
    );

    let accountsGroup: AccountGroup[] = [];

    if (selectedNetworkId === 'all') {
      accountsGroup = (
        await engine.getWalletAccountsGroupedByNetwork(activeWallet.id)
      )
        .reduce((accumulate, current) => {
          const network = networksMap.get(current.networkId);
          if (!network) return accumulate;
          return [...accumulate, { title: network, data: current.accounts }];
        }, [] as AccountGroup[])
        .filter((group) => group.data.length > 0);
    } else {
      const network = networksMap.get(selectedNetworkId);
      if (!network || !activeWallet) return;
      const data = await engine.getAccounts(activeWallet.accounts, network.id);
      accountsGroup = [
        {
          title: network,
          data,
        },
      ];
    }

    setActiveAccounts(accountsGroup);
  }, [activeWallet, engine, selectedNetworkId]);

  const options = useMemo(() => {
    const selectNetworkExists = enabledNetworks.find(
      (network) => network.id === selectedNetworkId,
    );
    if (!selectNetworkExists)
      setTimeout(() => setSelectedNetworkId(AllNetwork));

    if (!enabledNetworks) return [];

    const networks: SelectItem<string>[] = enabledNetworks.map((network) => ({
      label: network.shortName,
      value: network.id,
      tokenProps: {
        src: network.logoURI,
        letter: network.shortName,
      },
      badge: network.impl === 'evm' ? 'EVM' : undefined,
    }));
    networks.unshift({
      label: intl.formatMessage({ id: 'option__all' }),
      value: AllNetwork,
      iconProps: {
        name: 'OptionListAllSolid',
        size: isVerticalLayout ? 32 : 24,
        color: 'surface-neutral-default',
      },
    });

    return networks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledNetworks, isVerticalLayout, intl]);

  const handleChange = useCallback(
    (item: AccountEngineType, value) => {
      switch (value) {
        case 'rename':
          DialogManager.show({
            render: (
              <AccountModifyNameDialog
                visible
                account={item}
                onDone={() => {
                  refreshAccounts();
                }}
              />
            ),
          });

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
        options={
          type !== 'hw'
            ? [
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
              ]
            : [
                {
                  label: intl.formatMessage({ id: 'action__rename' }),
                  value: 'rename',
                  iconProps: {
                    name: isVerticalLayout ? 'TagOutline' : 'TagSolid',
                  },
                },
              ]
        }
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
    if (isOpen && defaultSelectedWallet) {
      setSelectedWallet(defaultSelectedWallet);
    }
  }, [defaultSelectedWallet, isOpen]);

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
        <Box m={2}>
          <Select
            setPositionOnlyMounted
            positionTranslateY={4}
            dropdownPosition="right"
            value={selectedNetworkId}
            onChange={setSelectedNetworkId}
            title={intl.formatMessage({ id: 'network__networks' })}
            options={options}
            isTriggerPlain
            footerText={intl.formatMessage({ id: 'action__customize_network' })}
            footerIcon="PencilSolid"
            onPressFooter={() => {
              setTimeout(() => {
                navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.ManageNetwork,
                  params: {
                    screen: ManageNetworkRoutes.Listing,
                    params: { onEdited: refreshAccounts },
                  },
                });
              }, 500);
            }}
            renderTrigger={(activeOption, isHovered, visible) => (
              <Box
                display="flex"
                flexDirection="row"
                alignItems="center"
                py={2}
                pl="3"
                pr="2.5"
                borderWidth="1"
                borderColor={
                  // eslint-disable-next-line no-nested-ternary
                  visible
                    ? 'focused-default'
                    : isHovered
                    ? 'border-hovered'
                    : 'border-default'
                }
                borderRadius="xl"
                bg={
                  // eslint-disable-next-line no-nested-ternary
                  visible
                    ? 'surface-selected'
                    : // eslint-disable-next-line no-nested-ternary
                    isHovered
                    ? 'surface-hovered'
                    : 'surface-default'
                }
              >
                <Box
                  display="flex"
                  flex={1}
                  flexDirection="row"
                  alignItems="center"
                  mr="1"
                >
                  {!!activeOption.tokenProps && (
                    <Box mr="3">
                      <Token
                        size={activeOption.description ? 8 : 6}
                        {...activeOption.tokenProps}
                      />
                    </Box>
                  )}
                  {!!activeOption.iconProps && (
                    <Box mr="3">
                      <Icon {...activeOption.iconProps} size={24} />
                    </Box>
                  )}
                  <Box flex={1}>
                    <Text
                      typography={{ sm: 'Body1', md: 'Body2' }}
                      numberOfLines={1}
                      flex={1}
                      isTruncated
                    >
                      {activeOption.label ?? '-'}
                    </Text>
                  </Box>
                </Box>
                <Icon size={20} name="ChevronDownSolid" />
              </Box>
            )}
          />
        </Box>

        <SectionList
          stickySectionHeadersEnabled
          sections={activeAccounts}
          SectionSeparatorComponent={(section) => (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            <Box h={section?.leadingItem ? 2 : 0} />
          )}
          ItemSeparatorComponent={() => <Box h={2} />}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={({ item, section }) => (
            <Pressable
              px={2}
              onPress={() => {
                setHaptics();
                serviceNetwork.changeActiveNetwork(section?.title?.id);
                serviceAccount.changeActiveAccount({
                  accountId: item.id,
                  walletId: activeWallet?.id ?? '',
                });
                setTimeout(() => {
                  navigation.dispatch(DrawerActions.closeDrawer());
                });
              }}
            >
              {({ isHovered, isPressed }) => (
                <HStack
                  p="7px"
                  borderWidth={1}
                  borderColor={isHovered ? 'border-hovered' : 'transparent'}
                  bgColor={isPressed ? 'surface-pressed' : undefined}
                  borderStyle="dashed"
                  bg={
                    currentSelectedAccount?.id === item.id &&
                    activeNetwork?.id === section?.title?.id
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
          renderSectionHeader={({ section: { title } }) =>
            activeAccounts.length > 1 ? (
              <Box
                px={4}
                p={2}
                bg="surface-subdued"
                flexDirection="row"
                alignItems="center"
              >
                <NetworkIcon network={title} size={4} mr={2} />
                <Typography.Subheading color="text-subdued">
                  {title.shortName}
                </Typography.Subheading>
              </Box>
            ) : null
          }
        />

        <Box p={2}>
          <Pressable
            onPress={() => {
              if (!activeWallet) return;
              const networkSettings = activeNetwork?.settings;
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
                    params: { mode: 'privatekey' },
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
        </Box>
      </VStack>
      {RemoveAccountDialog}
    </>
  );
};

export default AccountSelectorChildren;
