import React, { FC } from 'react';

import { CommonActions } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import Box from '../../Box';
import Icon from '../../Icon';
import Pressable from '../../Pressable';
import { useThemeValue } from '../../Provider/hooks';
import ScrollView from '../../ScrollView';
import Typography from '../../Typography';
import VStack from '../../VStack';

import type { ChildProps } from '..';

const Sidebar: FC<ChildProps> = ({ tabs, navigation, activeRouteName }) => {
  const intl = useIntl();
  const [activeFontColor, inactiveFontColor] = useThemeValue([
    'text-default',
    'text-subdued',
  ]);
  return (
    <Box
      position="relative"
      w={64}
      h="full"
      bg="surface-subdued"
      borderRightWidth={1}
      borderRightColor="border-subdued"
    >
      <VStack flex={1}>
        {/* AccountSelector */}
        <Box py={1} px={4}>
          <Typography.Body2Strong>AccountSelector here.</Typography.Body2Strong>
        </Box>
        {/* Scrollable area */}
        <ScrollView
          _contentContainerStyle={{
            flex: 1,
            py: 5,
            px: 4,
          }}
        >
          <VStack space={1}>
            {tabs.map((route) => {
              const isActive = activeRouteName === route.name;
              const onPress = () => {
                if (isActive) return;
                navigation.dispatch({
                  ...CommonActions.navigate({
                    name: route.name,
                    merge: true,
                  }),
                });
              };

              return (
                <Pressable
                  key={route.name}
                  onPress={onPress}
                  _hover={!isActive ? { bg: 'surface-hovered' } : undefined}
                  bg={isActive ? 'surface-selected' : undefined}
                  borderRadius="xl"
                  p="2"
                >
                  <Box
                    aria-current={isActive ? 'page' : undefined}
                    display="flex"
                    flexDirection="column"
                  >
                    <Box display="flex" flexDirection="row" alignItems="center">
                      <Icon
                        name={route.icon}
                        color={isActive ? 'icon-pressed' : 'icon-default'}
                        size={24}
                      />

                      <Typography.Body2Strong
                        ml="3"
                        color={isActive ? activeFontColor : inactiveFontColor}
                      >
                        {intl.formatMessage({ id: route.translationId })}
                      </Typography.Body2Strong>
                    </Box>
                  </Box>
                  {/* In the future, perhaps a 'Badge' will be placed here. */}
                </Pressable>
              );
            })}
          </VStack>
          <VStack space={1} pt={1} mt="auto">
            <Typography.Body2Strong>
              Address book and settings here.
            </Typography.Body2Strong>
          </VStack>
        </ScrollView>
      </VStack>
    </Box>
  );
};
export default Sidebar;
