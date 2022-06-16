import React, { FC, useCallback } from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';

import {
  Box,
  Divider,
  Modal,
  Pressable,
  Text,
  TokenGroup,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';

import {
  OverviewAllCryptoRoutes,
  OverviewAllCryptoRoutesParams,
} from '../../../routes/Modal/OverviewAllCrypto';
import BalanceText from '../Components/BalanceText';

type RouteProps = RouteProp<
  OverviewAllCryptoRoutesParams,
  OverviewAllCryptoRoutes.OverviewAllCryptoScreen
>;

export const OverviewAllCrypto: FC = () => {
  const modalClose = useModalClose();
  const route = useRoute<RouteProps>();
  const { tokens, onPress } = route.params;
  const renderItem = useCallback(
    ({ item, index }) => (
      <Pressable
        width="full"
        height="76px"
        paddingX="16px"
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        bgColor="surface-default"
        borderTopRadius={index === 0 ? '12px' : 0}
        borderBottomRadius={index === tokens.length - 1 ? '12px' : 0}
        onPress={() => {
          if (onPress) {
            modalClose();
            onPress(item);
          }
        }}
      >
        <TokenGroup
          size="lg"
          tokens={[{ chain: 'eth' }]}
          cornerToken={{ chain: 'eth' }}
        />
        <Text ml="12px" typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
          ETH
        </Text>

        <Box flexDirection="column" alignItems="flex-end" flex={1}>
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            562.61 USDT
          </Text>
          <BalanceText
            text="$6562.61"
            typography="Body2"
            startColor="text-subdued"
          />
        </Box>
      </Pressable>
    ),
    [onPress, tokens.length],
  );

  return (
    <Modal
      height="560px"
      header="All Cryptos"
      hideSecondaryAction
      footer={null}
      flatListProps={{
        data: tokens,
        // @ts-ignore
        renderItem,
        ItemSeparatorComponent: () => <Divider />,
        showsVerticalScrollIndicator: false,
        ListHeaderComponent: () => (
          <Box pb="24px">
            <BalanceText text="$541.87" typography="DisplayLarge" />
          </Box>
        ),
      }}
    />
  );
};

export default OverviewAllCrypto;
