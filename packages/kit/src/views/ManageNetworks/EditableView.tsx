import React, { FC, useState } from 'react';

import {
  Box,
  Divider,
  Icon,
  Pressable,
  ScrollView,
  SortableList,
  Switch,
  Token,
  Typography,
} from '@onekeyhq/components';

type ChainInfo = { chain: string; name: string };

const evmNetworks: ChainInfo[] = [
  { chain: 'eth', name: 'ETH' },
  { chain: 'bsc', name: 'BSC' },
  { chain: 'heco', name: 'HECO' },
  { chain: 'localhost', name: 'Localhost' },
];

export const EditableView: FC = () => {
  const [list, setList] = useState(evmNetworks);
  const renderItem = ({
    item,
    drag,
  }: {
    item: ChainInfo;
    drag: () => void;
  }) => (
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      p="4"
    >
      <Box display="flex" flexDirection="row" alignItems="center">
        <Pressable onPressIn={() => drag()} mr="2">
          <Icon name="MenuOutline" size={16} />
        </Pressable>
        <Token chain={item.chain} name={item.name} size={8} />
      </Box>
      <Switch labelType="false" />
    </Box>
  );
  return (
    <ScrollView>
      <Box>
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography.Heading>EVM</Typography.Heading>
        </Box>
        <Box bg="surface-default" borderRadius="12" mt="3" mb="3">
          <SortableList.Container
            keyExtractor={({ chain }) => chain}
            data={list}
            onDragEnd={({ data }) => setList(data)}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <Divider />}
          />
        </Box>
      </Box>
    </ScrollView>
  );
};

export default EditableView;
