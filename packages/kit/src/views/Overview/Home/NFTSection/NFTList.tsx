import React, { FC, useCallback } from 'react';

import {
  Badge,
  Box,
  Divider,
  FlatList,
  Icon,
  Image,
  Pressable,
  Text,
} from '@onekeyhq/components';

import { ListProps } from '../../type';

const NFTList: FC<ListProps> = ({ datas }) => {
  const renderItem = useCallback(
    () => (
      <Pressable
        width="full"
        height="76px"
        paddingX="16px"
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Box flex={1} mr="12px" flexDirection="row" alignItems="center">
          <Image size="32px" bgColor="red.400" borderRadius="16px" />
          <Text
            ml="12px"
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            numberOfLines={2}
            flex={1}
          >
            ENS: Ethereum Name Service
          </Text>
        </Box>

        <Box flexDirection="row" justifyContent="flex-end">
          <Badge title="50" size="sm" type="default" />
          <Icon name="ChevronRightSolid" />
        </Box>
      </Pressable>
    ),
    [],
  );

  return (
    <Box width="100%" borderRadius="12px" bgColor="surface-default">
      <FlatList
        data={datas}
        ItemSeparatorComponent={() => <Divider />}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${index}`}
      />
    </Box>
  );
};

export default NFTList;
