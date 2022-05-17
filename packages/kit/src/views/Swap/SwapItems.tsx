import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Box, Center, Icon, Pressable, Typography } from '@onekeyhq/components';

import { useNavigation } from '../../hooks';
import { HomeRoutes, RootRoutes } from '../../routes/types';

const SwapItems = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const onPress = useCallback(() => {
    navigation.navigate(RootRoutes.Root, {
      screen: HomeRoutes.TransactionHistoryScreen,
      params: {},
    });
  }, [navigation]);
  return (
    <Center>
      <Box
        bg="surface-default"
        shadow="depth.2"
        mt="6"
        maxW="420"
        w="full"
        borderRadius={12}
      >
        <Pressable
          h="56px"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          px="6"
          onPress={onPress}
        >
          <Box flexDirection="row">
            <Icon name="ClockSolid" size={24} />
            <Typography.Body2Strong ml="4">
              {intl.formatMessage({ id: 'transaction__history' })}
            </Typography.Body2Strong>
          </Box>
          <Box>
            <Icon name="ChevronRightSolid" size={20} />
          </Box>
        </Pressable>
      </Box>
    </Center>
  );
};

export default SwapItems;
