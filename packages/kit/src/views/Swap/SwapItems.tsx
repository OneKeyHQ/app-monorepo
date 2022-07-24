import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Icon,
  Pressable,
  Text,
  useTheme,
} from '@onekeyhq/components';

import { useNavigation } from '../../hooks';
import { HomeRoutes, HomeRoutesParams } from '../../routes/types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<HomeRoutesParams>;

const SwapItems = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { themeVariant } = useTheme();
  const onPress = useCallback(() => {
    navigation.navigate(HomeRoutes.SwapHistory);
  }, [navigation]);
  return (
    <Center px={4} pb="4">
      <Box
        bg="surface-default"
        mt="6"
        maxW="420"
        w="full"
        borderRadius={12}
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        borderColor="border-subdued"
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
