import React, { ComponentProps, FC, useCallback, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Account,
  Box,
  FlatList,
  HStack,
  Icon,
  IconButton,
  Image,
  Pressable,
  ScrollView,
  Select,
  Typography,
  VStack,
  useUserDevice,
} from '@onekeyhq/components';
// import MiniDeviceIcon from '@onekeyhq/components/img/deviceIcon_mini.png';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
  ImportAccountModalRoutes,
  ImportAccountRoutesParams,
  ModalRoutes,
  WatchedAccountModalRoutes,
  WatchedAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.CreateAccountForm
> &
  NativeStackNavigationProp<
    ImportAccountRoutesParams,
    ImportAccountModalRoutes.ImportAccountModal
  > &
  NativeStackNavigationProp<
    WatchedAccountRoutesParams,
    WatchedAccountModalRoutes.WatchedAccountModal
  >;

// const WATCHED_ACCOUNTS = [];
// const IMPORTED_ACCOUNTS = [];
// const HD_ACCOUNTS = [];
const NORMAL_ACCOUNTS = [
  {
    address: '0x76f3f64cb3cd19debee51436df630a342b736c24',
    label: 'Wallet',
  },
];

type AccountType = 'normal' | 'hd' | 'imported' | 'watched';

type ChildrenProps = {
  handleToggleVisible: () => void;
};

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

const AccountSelectorChildren: FC<ChildrenProps> = ({
  handleToggleVisible,
}) => {
  const { size } = useUserDevice();
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const [activeAccountType, setActiveAccountType] =
    useState<AccountType>('normal');

  const handleChange = useCallback(
    (type) => {
      if (type === 'addAccount') {
        handleToggleVisible();
        setTimeout(() => {
          navigation.navigate(ModalRoutes.CreateAccountForm);
        }, 200);
      }
    },
    [navigation, handleToggleVisible],
  );

  function renderSideAction(type: AccountType, onChange: (v: string) => void) {
    if (type === 'normal') {
      return (
        <Select
          dropdownPosition="left"
          onChange={onChange}
          asAction
          options={[
            {
              label: intl.formatMessage({ id: 'action__rename' }),
              value: 'rename',
              iconProps: {
                name: ['SMALL', 'NORMAL'].includes(size)
                  ? 'TagOutline'
                  : 'TagSolid',
              },
            },
            {
              label: intl.formatMessage({ id: 'action__add_account' }),
              value: 'addAccount',
              iconProps: {
                name: ['SMALL', 'NORMAL'].includes(size)
                  ? 'PlusCircleOutline'
                  : 'PlusCircleSolid',
              },
            },
            {
              label: intl.formatMessage({ id: 'action__view_details' }),
              value: 'detail',
              iconProps: {
                name: ['SMALL', 'NORMAL'].includes(size)
                  ? 'DocumentTextOutline'
                  : 'DocumentTextSolid',
              },
            },
            {
              label: intl.formatMessage({ id: 'action__export_private_key' }),
              value: 'export',
              iconProps: {
                name: ['SMALL', 'NORMAL'].includes(size)
                  ? 'UploadOutline'
                  : 'UploadSolid',
              },
            },
            {
              label: intl.formatMessage({ id: 'action__remove_account' }),
              value: 'remove',
              iconProps: {
                name: ['SMALL', 'NORMAL'].includes(size)
                  ? 'TrashOutline'
                  : 'TrashSolid',
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

    if (type === 'watched') {
      return (
        <IconButton
          name="PlusSolid"
          type="plain"
          onPress={() => {
            handleToggleVisible();
            setTimeout(
              () =>
                navigation.navigate(
                  WatchedAccountModalRoutes.WatchedAccountModal,
                ),
              150,
            );
          }}
        />
      );
    }

    if (type === 'imported') {
      return (
        <IconButton
          name="PlusSolid"
          type="plain"
          onPress={() => {
            handleToggleVisible();
            setTimeout(
              () =>
                navigation.navigate(
                  ImportAccountModalRoutes.ImportAccountModal,
                ),
              150,
            );
          }}
        />
      );
    }
  }

  type WalletItemProps = {
    isSelected?: boolean;
    decorationColor?: string;
    walletType?: AccountType;
    emoji?: string;
    deviceIconUrl?: string;
  } & ComponentProps<typeof Pressable>;

  const WalletItemDefaultProps = {
    isSelected: false,
    decorationColor: 'surface-neutral-default',
  } as const;

  const WalletItem: FC<WalletItemProps> = ({
    isSelected,
    decorationColor,
    walletType,
    emoji,
    deviceIconUrl,
    ...rest
  }) => (
    <Pressable {...rest}>
      {({ isHovered }) => (
        <HStack pr={2} space="5px">
          <Box
            w="3px"
            borderTopRightRadius="full"
            borderBottomRightRadius="full"
            bg={
              // eslint-disable-next-line no-nested-ternary
              isSelected
                ? 'interactive-default'
                : isHovered
                ? 'icon-subdued'
                : 'transparent'
            }
          />
          <Box
            w={12}
            h={12}
            bg={decorationColor}
            borderRadius={isSelected ? 'xl' : 'full'}
            alignItems="center"
            justifyContent="center"
          >
            {walletType === 'normal' && (
              <Typography.DisplayLarge>
                {emoji && emoji}
              </Typography.DisplayLarge>
            )}
            {walletType === 'hd' && (
              <Image
                width="22px"
                height="32px"
                source={{ uri: deviceIconUrl }}
              />
            )}
            {walletType === 'imported' && <Icon name="SaveOutline" />}
            {walletType === 'watched' && <Icon name="EyeOutline" />}
          </Box>
        </HStack>
      )}
    </Pressable>
  );

  WalletItem.defaultProps = WalletItemDefaultProps;

  return (
    <>
      <VStack borderRightWidth={1} borderRightColor="border-subdued">
        <ScrollView>
          <VStack space={6} py={2}>
            {/* APP Wallet */}
            <VStack space={2}>
              <WalletItem
                onPress={() => setActiveAccountType('normal')}
                isSelected={activeAccountType === 'normal'}
                decorationColor="#FFF7D7"
                walletType="normal"
                emoji="👽"
              />
            </VStack>
            {/* Hardware Wallet */}
            {/* <VStack space={2}>
              <WalletItem
                onPress={() => setActiveAccountType('hd')}
                isSelected={activeAccountType === 'hd'}
                decorationColor="#FFE0DF"
                walletType="hd"
                deviceIconUrl={MiniDeviceIcon}
              />
            </VStack> */}
            {/* Imported or watched wallet */}
            <VStack space={2}>
              <WalletItem
                onPress={() => setActiveAccountType('imported')}
                isSelected={activeAccountType === 'imported'}
                walletType="imported"
              />
              <WalletItem
                onPress={() => setActiveAccountType('watched')}
                isSelected={activeAccountType === 'watched'}
                walletType="watched"
              />
            </VStack>
          </VStack>
        </ScrollView>
        <Box p={2}>
          <IconButton type="plain" name="PlusOutline" size="xl" />
        </Box>
      </VStack>
      <VStack flex={1}>
        <HStack zIndex={99} py={3} px={4} space={4} alignItems="center">
          <VStack flex={1}>
            <Typography.Body1Strong>Wallet #2</Typography.Body1Strong>
            <Typography.Caption color="text-subdued">
              Network: Ethereum
            </Typography.Caption>
          </VStack>
          {renderSideAction(activeAccountType, handleChange)}
        </HStack>
        <ScrollView px={2}>
          <FlatList
            data={NORMAL_ACCOUNTS}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item }) => (
              <Pressable>
                {({ isHovered }) => (
                  <HStack
                    p="7px"
                    borderWidth={1}
                    borderColor={isHovered ? 'border-hovered' : 'transparent'}
                    space={4}
                    borderRadius="xl"
                  >
                    <Box flex={1}>
                      <Account address={item.address} name={item.label} />
                    </Box>
                    <CustomSelectTrigger />
                  </HStack>
                )}
              </Pressable>
            )}
          />
          <Pressable mt={2}>
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
        </ScrollView>
      </VStack>
    </>
  );
};

export default AccountSelectorChildren;
