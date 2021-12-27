import React, { FC } from 'react';

import { CommonActions } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import Box from '../../Box';
import Icon from '../../Icon';
import Pressable from '../../Pressable';
import { useThemeValue } from '../../Provider/hooks';
import Typography from '../../Typography';

import type { ChildProps } from '..';

const Sidebar: FC<ChildProps> = ({ tabs, navigation, activeRouteName }) => {
  const intl = useIntl();
  const [activeFontColor, inactiveFontColor] = useThemeValue([
    'text-default',
    'text-subdued',
  ]);
  return (
    <Box position="relative" width="260px" height="100%">
      <Box
        bg="surface-subdued"
        width="100%"
        display="flex"
        flexDirection="column"
        height="100%"
        pb="24px"
        borderRightWidth="1px"
        borderRightColor="border-subdued"
      >
        <Box px="16px" flex="1" display="flex" flexDirection="column">
          <Box mt="6">
            {tabs.map((route) => {
              const isActive = activeRouteName === route.name;
              const onPress = () => {
                if (isActive) return;
                navigation.dispatch({
                  ...CommonActions.navigate({ name: route.name, merge: true }),
                });
              };

              return (
                <Pressable key={route.name} onPress={onPress}>
                  <Box
                    bg={isActive ? 'background-selected' : undefined}
                    p="3"
                    mt="1"
                    aria-current={isActive ? 'page' : undefined}
                    display="flex"
                    flexDirection="column"
                    borderRadius="12px"
                  >
                    <Box display="flex" flexDirection="row" alignItems="center">
                      <Icon
                        name={route.icon}
                        color={isActive ? 'text-default' : 'text-subdued'}
                        size={24}
                      />

                      <Typography.Body2
                        ml="3"
                        color={isActive ? activeFontColor : inactiveFontColor}
                      >
                        {intl.formatMessage({ id: route.translationId })}
                      </Typography.Body2>
                    </Box>
                  </Box>
                </Pressable>
              );
            })}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
export default Sidebar;
