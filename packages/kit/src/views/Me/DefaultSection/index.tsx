import React from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Icon, Pressable } from '@onekeyhq/components';
import { Text } from '@onekeyhq/components/src/Typography';
import { HomeRoutes, HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.SettingsWebviewScreen
>;

export const DefaultSection = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  return (
    <Box w="full" mb="6">
      <Box borderRadius="12" bg="surface-default">
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          onPress={() => {}}
        >
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex="1"
            numberOfLines={1}
            mr="3"
          >
            {intl.formatMessage({ id: 'title__address_book' })}
          </Text>
          <Box>
            <Icon name="ChevronRightSolid" size={20} />
          </Box>
        </Pressable>
        {platformEnv.isNative ? (
          <Pressable
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            borderTopWidth="1"
            borderTopColor="divider"
            py={4}
            px={{ base: 4, md: 6 }}
            onPress={() => {
              navigation.navigate(HomeRoutes.ScreenOnekeyLiteDetail);
            }}
          >
            <Text
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              flex="1"
              numberOfLines={1}
              mr="3"
            >
              {intl.formatMessage({
                id: 'app__hardware_name_onekey_lite',
              })}
            </Text>
            <Box>
              <Icon name="ChevronRightSolid" size={20} />
            </Box>
          </Pressable>
        ) : null}
      </Box>
    </Box>
  );
};
