import React, { FC, useState } from 'react';

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
import ImportedAccount from '@onekeyhq/kit/src/views/Account/ImportedAccount';
import WatchedAccount from '@onekeyhq/kit/src/views/Account/WatchedAccount';

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

function renderSideAction(type: AccountType, size: string) {
  if (type === 'normal') {
    return (
      <Select
        dropdownPosition="right"
        options={[
          {
            label: 'Rename',
            value: 'rename',
            iconProps: {
              name: 'TagOutline',
              size: 24,
            },
          },
          {
            label: 'View Details',
            value: 'detail',
            iconProps: {
              name: 'DocumentTextSolid',
              size: 24,
            },
          },
          {
            label: 'Export Private Key',
            value: 'export',
            iconProps: {
              name: 'UploadSolid',
              size: 24,
            },
          },
          {
            label: 'Remove Account',
            value: 'remove',
            iconProps: {
              name: 'TrashSolid',
              size: 24,
              color: 'icon-critical',
            },
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
      <WatchedAccount
        trigger={
          <Pressable px="2" justifyContent="center">
            <Icon name="PlusOutline" />
          </Pressable>
        }
      />
    );
  }

  if (type === 'imported') {
    return (
      <ImportedAccount
        trigger={
          <Pressable px="2" justifyContent="center">
            <Icon name="PlusOutline" />
          </Pressable>
        }
      />
    );
  }
}

const AccountSelectorChildren: FC = () => {
  const { size } = useUserDevice();
  const [activeAccountType, setActiveAccountType] =
    useState<AccountType>('normal');
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
          {renderSideAction(activeAccountType, size)}
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
