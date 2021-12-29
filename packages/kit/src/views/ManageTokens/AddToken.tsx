import React, { FC } from 'react';

import {
  Box,
  Divider,
  FlatList,
  Flex,
  Modal,
  Token,
  Typography,
} from '@onekeyhq/components';

type AddTokenProps = { visible: boolean; onClose: () => void };
type ListItem = { label: string; value: string };

const AddToken: FC<AddTokenProps> = ({ visible, onClose }) => {
  const items: ListItem[] = [
    { label: 'Name', value: 'USD Coain' },
    { label: 'Symbol', value: 'USDC' },
    { label: 'Contact', value: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
    { label: 'Decimal', value: '6' },
    { label: 'Balance', value: '11USDC' },
  ];
  const renderItem = ({ item }: { item: ListItem }) => (
    <Flex
      display="flex"
      direction="row"
      justifyContent="space-between"
      p="4"
      alignItems="center"
    >
      <Typography.Body1 color="text-subdued">{item.label}</Typography.Body1>
      <Typography.Body1>{item.value}</Typography.Body1>
    </Flex>
  );
  return (
    <Modal visible={visible} onClose={onClose} header="Add Token">
      <Box>
        <Box
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          my="4"
        >
          <Token
            chain="eth"
            address="0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
          />
          <Typography.Heading>USDC Coin(USDC)</Typography.Heading>
        </Box>
        <FlatList
          bg="surface-default"
          borderRadius="12"
          mt="3"
          mb="3"
          data={items}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <Divider />}
          keyExtractor={(_, index: number) => index.toString()}
          showsVerticalScrollIndicator={false}
        />
      </Box>
    </Modal>
  );
};

export default AddToken;
