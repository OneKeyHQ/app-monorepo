import React, { useCallback, useRef } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { Animated } from 'react-native';

import {
  Box,
  Button,
  Center,
  HStack,
  Icon,
  IconButton,
  Typography,
} from '@onekeyhq/components';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import { useSwapQuoteCallback } from './hooks/useSwap';
import { SwapRoutes } from './typings';

const SwapHeader = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const onSwapQuoteCallback = useSwapQuoteCallback({ silent: false });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const onHandleRefresh = useCallback(() => {
    onSwapQuoteCallback();
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [onSwapQuoteCallback, fadeAnim]);
  const onSetting = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.Settings,
      },
    });
  }, [navigation]);
  return (
    <Center w="full" my="6" px="4">
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        maxW="768"
        width="full"
      >
        <Typography.DisplayLarge>
          {intl.formatMessage({ id: 'title__swap' })}
        </Typography.DisplayLarge>
        <HStack>
          <Button type="plain" onPress={onHandleRefresh} pl="2" pr="2">
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
              }}
            >
              <Icon name="RefreshOutline" size={20} />
            </Animated.View>
          </Button>
          <IconButton type="plain" name="CogOutline" onPress={onSetting} />
        </HStack>
      </Box>
    </Center>
  );
};

export default SwapHeader;
