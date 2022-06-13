import React, { FC, useCallback } from 'react';

import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Divider,
  FlatList,
  Pressable,
  Text,
  TokenGroup,
} from '@onekeyhq/components';

import ChartView from '../../Components/ChartView';
import { ListProps } from '../../type';

const CryptosList: FC<ListProps> = ({ datas }) => {
  const intl = useIntl();

  const renderItem: ListRenderItem = useCallback(
    ({ item, index }) => (
      <Pressable
        width="full"
        height="76px"
        paddingX="16px"
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <TokenGroup
          size="lg"
          name="BTC"
          description="0.00"
          tokens={[{ chain: 'eth' }]}
          cornerToken={{ chain: 'eth' }}
        />
        {/* <ChartView /> */}

        <Box flexDirection="column" alignItems="flex-end">
          <Text typography="Body1Strong">$2456.67</Text>
          <Text typography="Body2" color="text-success">
            +4.26%
          </Text>
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

export default CryptosList;
