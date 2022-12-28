/* eslint-disable no-nested-ternary */
import type { FC } from 'react';
import { isValidElement } from 'react';

import { Box, HStack, Pressable, Text } from '@onekeyhq/components';

export interface HeaderProps {
  title?: string;
  actions?: [{ label?: string; onPress: () => void }];
}

const Header: FC<HeaderProps> = ({ title, actions }) => (
  <HStack alignItems="center" p={2}>
    <Text typography="Heading" flex={1} mr={3}>
      {title}
    </Text>
    {actions?.length ? (
      <HStack space={6}>
        {actions.map((item) => {
          const label = isValidElement(item.label) ? (
            item.label
          ) : (
            <Text typography="Body1Strong" color="text-subdued">
              {item.label}
            </Text>
          );
          return (
            <Pressable onPress={item.onPress} hitSlop={8}>
              {({ isHovered, isPressed }) => (
                <Box m={-2}>
                  <Box
                    p={2}
                    rounded="xl"
                    bgColor={
                      isPressed
                        ? 'surface-pressed'
                        : isHovered
                        ? 'surface-hovered'
                        : undefined
                    }
                  >
                    {label}
                  </Box>
                </Box>
              )}
            </Pressable>
          );
        })}
      </HStack>
    ) : null}
  </HStack>
);

export default Header;
