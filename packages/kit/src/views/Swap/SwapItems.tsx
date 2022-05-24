import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Box, Center, Icon, Pressable, Text } from '@onekeyhq/components';

import { useNavigation } from '../../hooks';
import { setHaptics } from '../../hooks/setHaptics';
import { HomeRoutes, RootRoutes } from '../../routes/types';

const SwapItems = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const onPress = useCallback(() => {
    setHaptics();
    navigation.navigate(RootRoutes.Root, {
      screen: HomeRoutes.TransactionHistoryScreen,
      params: {},
    });
  }, [navigation]);
  return (
    <Center px={4} pb="4">
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
          <Box flexDirection="row" alignItems="center">
            <Icon name="ClockOutline" size={24} />
            <Text ml="4" typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
              {intl.formatMessage({ id: 'transaction__history' })}
            </Text>
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
