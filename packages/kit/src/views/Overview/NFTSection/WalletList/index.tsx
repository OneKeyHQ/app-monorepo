import React, { FC, useCallback } from 'react';

import {
  Badge,
  Box,
  FlatList,
  Icon,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import WalletAvatar from '../../../../components/Header/WalletAvatar';
import { ListProps } from '../../type';

const WalletContent: FC = () => (
  <Box
    flexDirection="row"
    alignItems="center"
    justifyContent="space-between"
    flex={1}
  >
    <Box flexDirection="row" alignItems="center">
      <WalletAvatar
        size="sm"
        walletImage="hd"
        circular
        avatar={{ emoji: '🤑', bgColor: '#55A9D9' }}
      />
      <Text ml="12px" typography="Body1Strong">
        Wallet #2
      </Text>
    </Box>
    <Box flexDirection="row" justifyContent="flex-end">
      <Badge title="50" size="sm" type="default" />
      <Icon name="ChevronRightSolid" />
    </Box>
  </Box>
);

const Mobile: FC<ListProps> = ({ datas }) => {
  const renderItem = useCallback(
    () => (
      <Pressable
        height="64px"
        width="full"
        bgColor="surface-default"
        borderRadius="12px"
        mb="16px"
        paddingX="16px"
      >
        <WalletContent />
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
  const renderItem = useCallback(
    ({ index }) => (
      <Pressable
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        mr={index % 2 === 0 ? '16px' : '0px'}
        width={`${itemWidth}px`}
        height="64px"
        paddingX="16px"
        bgColor="surface-default"
        borderRadius="12px"
        mb="16px"
      >
        <WalletContent />
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
