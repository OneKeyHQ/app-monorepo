import React, { FC } from 'react';

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

const AccountSelectorChildren: FC = () => {
  const { size } = useUserDevice();
  return (
    <>
      <Box p="2">
        <VStack space={2}>
          <Box w="48px" h="48px" bg="#FFF7D7" borderRadius="48px" />
          <Box w="48px" h="48px" bg="#FFF7D7" borderRadius="48px" />
          <Box w="48px" h="48px" bg="#FFF7D7" borderRadius="48px" />
        </VStack>
        <Divider bg="border-subdued" my="2" />
        <VStack space={2}>
          <Box w="48px" h="48px" bg="#FFF7D7" borderRadius="48px" />
          <Box w="48px" h="48px" bg="#FFF7D7" borderRadius="48px" />
          <Box w="48px" h="48px" bg="#FFF7D7" borderRadius="48px" />
        </VStack>
        <Divider bg="border-subdued" my="2" />
        <VStack space={2}>
          <Box w="48px" h="48px" bg="#FFF7D7" borderRadius="48px" />
          <Box w="48px" h="48px" bg="#FFF7D7" borderRadius="48px" />
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
              py: 2,
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
        </Box>
        <FlatList
          data={[
            {
              address: '0x76f3f64cb3cd19debee51436df630a342b736c24',
              label: 'Wallet',
            },
            {
              address: '0x76f3f64cb3cd19debee51436df630a342b736c24',
              label: 'Wallet',
            },
            {
              address: '0x76f3f64cb3cd19debee51436df630a342b736c24',
              label: 'Wallet',
            },
          ]}
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
