import React, { FC, useCallback, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Account,
  Box,
  Divider,
  FlatList,
  Icon,
  IconButton,
  Pressable,
  Select,
  Typography,
  VStack,
  useUserDevice,
} from '@onekeyhq/components';
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
                name: 'TagOutline',
              },
            },
            {
              label: intl.formatMessage({ id: 'action__add_account' }),
              value: 'addAccount',
              iconProps: {
                name: 'PlusCircleOutline',
              },
            },
            {
              label: intl.formatMessage({ id: 'action__view_details' }),
              value: 'detail',
              iconProps: {
                name: 'DocumentTextSolid',
              },
            },
            {
              label: intl.formatMessage({ id: 'action__export_private_key' }),
              value: 'export',
              iconProps: {
                name: 'UploadSolid',
              },
            },
            {
              label: intl.formatMessage({ id: 'action__remove_account' }),
              value: 'remove',
              iconProps: {
                name: 'TrashSolid',
              },
              destructive: true,
            },
          ]}
          triggerProps={{
            width: 'auto',
            py: 1,
            px: 2,
            borderRadius: 32,
          }}
          headerShown={false}
          footer={null}
          containerProps={{ width: 'auto' }}
          dropdownProps={{
            width: ['SMALL', 'NORMAL'].includes(size) ? '100%' : 248,
          }}
          renderTrigger={() => <Icon name="DotsHorizontalOutline" />}
        />
      );
    }

    if (type === 'watched') {
      return (
        <Pressable
          px="2"
          justifyContent="center"
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
        >
          <Icon name="PlusOutline" />
        </Pressable>
      );
    }

    if (type === 'imported') {
      return (
        <Pressable
          px="2"
          justifyContent="center"
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
        >
          <Icon name="PlusOutline" />
        </Pressable>
      );
    }
  }

  return (
    <>
      <Box p="2">
        <VStack space={2}>
          <Box
            borderLeftWidth="3px"
            borderColor={
              activeAccountType === 'normal'
                ? 'interactive-default'
                : 'transparent'
            }
            pl="1"
          >
            <Pressable
              w="48px"
              h="48px"
              bg="#FFF7D7"
              borderRadius="48px"
              justifyContent="center"
              alignItems="center"
              onPress={() => setActiveAccountType('normal')}
            >
              <Typography.Heading>👽</Typography.Heading>
            </Pressable>
          </Box>
        </VStack>
        <Divider bg="border-subdued" my="2" />
        <VStack space={2}>
          <Box
            borderLeftWidth="3px"
            borderColor={
              activeAccountType === 'hd' ? 'interactive-default' : 'transparent'
            }
            pl="1"
          >
            <Pressable
              w="48px"
              h="48px"
              bg="#FFE0DF"
              borderRadius="48px"
              justifyContent="center"
              alignItems="center"
              onPress={() => setActiveAccountType('hd')}
            >
              <Typography.Heading>👽</Typography.Heading>
            </Pressable>
          </Box>
        </VStack>
        <Divider bg="border-subdued" my="2" />
        <VStack space={2}>
          <Box
            borderLeftWidth="3px"
            borderColor={
              activeAccountType === 'imported'
                ? 'interactive-default'
                : 'transparent'
            }
            pl="1"
          >
            <Pressable
              w="48px"
              h="48px"
              bg="surface-neutral-default"
              borderRadius="48px"
              justifyContent="center"
              alignItems="center"
              onPress={() => setActiveAccountType('imported')}
            >
              <Icon name="InboxInOutline" />
            </Pressable>
          </Box>
          <Box
            borderLeftWidth="3px"
            borderColor={
              activeAccountType === 'watched'
                ? 'interactive-default'
                : 'transparent'
            }
            pl="1"
          >
            <Pressable
              w="48px"
              h="48px"
              bg="surface-neutral-default"
              borderRadius="48px"
              justifyContent="center"
              alignItems="center"
              onPress={() => setActiveAccountType('watched')}
            >
              <Icon name="EyeOutline" />
            </Pressable>
          </Box>
        </VStack>
        <Divider bg="border-subdued" my="2" />
      </Box>
      <Divider orientation="vertical" bg="border-subdued" />
      <Box p="2" flex="1">
        <Box
          p="2"
          flexDirection="row"
          justifyContent="space-between"
          width="100%"
          zIndex={99}
        >
          <Box>
            <Typography.Body1>Wallet #2</Typography.Body1>
            <Typography.Caption>Network: Ethereum</Typography.Caption>
          </Box>
          {renderSideAction(activeAccountType, handleChange)}
        </Box>
        <FlatList
          data={NORMAL_ACCOUNTS}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item }) => (
            <Pressable
              p="2"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Account address={item.address} name={item.label} />
              <IconButton type="plain" name="DotsHorizontalOutline" />
            </Pressable>
          )}
        />
      </Box>
    </>
  );
};

export default AccountSelectorChildren;
