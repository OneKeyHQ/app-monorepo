import React, { FC, useCallback } from 'react';

import { ListRenderItem } from 'react-native';

import {
  Box,
  FlatList,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import WalletAvatar from '../../../../components/Header/WalletAvatar';
import { ListProps } from '../../type';

const Mobile: FC<ListProps> = ({ datas }) => {
  const renderItem: ListRenderItem = useCallback(
    ({ item }) => (
      <Pressable
        flexDirection="row"
        height="64px"
        width="full"
        bgColor="surface-default"
        borderRadius="12px"
        mb="16px"
        paddingX="16px"
        alignItems="center"
      >
        <Box flexDirection="row">
          <WalletAvatar
            width="32px"
            height="32px"
            walletImage="hd"
            circular
            avatar={{ emoji: '🤑', bgColor: '#55A9D9' }}
          />
          <Text ml="12px" typography="Body1Strong">
            Wallet #2
          </Text>
        </Box>
      </Pressable>
    ),
    [],
  );
  return (
    <Box width="100%">
      <FlatList
        showsHorizontalScrollIndicator={false}
        data={datas}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${index}`}
      />
    </Box>
  );
};

const Desktop: FC<ListProps> = ({ datas }) => {
  const itemWidth = (768 - 16) / 2;
  const renderItem: ListRenderItem = useCallback(
    ({ item, index }) => (
      <Pressable
        mr={index % 2 === 0 ? '16px' : '0px'}
        width={`${itemWidth}px`}
        height="64px"
        bgColor="surface-default"
        borderRadius="12px"
        mb="16px"
      >
        {}
      </Pressable>
    ),
    [itemWidth],
  );

  return (
    <Box width="100%">
      <FlatList
        data={datas}
        renderItem={renderItem}
        numColumns={2}
        keyExtractor={(item, index) => `${index}`}
      />
    </Box>
  );
};

const WalletList: FC<ListProps> = ({ ...rest }) => {
  const isSmallScreen = useIsVerticalLayout();
  return isSmallScreen ? <Mobile {...rest} /> : <Desktop {...rest} />;
};

export default WalletList;
