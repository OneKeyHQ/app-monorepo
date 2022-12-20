/* eslint-disable no-nested-ternary */
import type { FC } from 'react';

import { Box, IconButton, Pressable, Text } from '@onekeyhq/components';

type ListItemProps = {
  isActive?: boolean;
  label?: string;
  address?: string;
  balance?: string;
};

const defaultProps = {} as const;

const ListItem: FC<ListItemProps> = ({ isActive, label, address, balance }) => (
  <Pressable>
    {({ isHovered, isPressed }) => (
      <Box
        flexDirection="row"
        alignItems="center"
        p={2}
        pr={1.5}
        rounded="xl"
        bgColor={
          isActive
            ? 'surface-selected'
            : isPressed
            ? 'surface-pressed'
            : isHovered
            ? 'surface-hovered'
            : 'transparent'
        }
      >
        <Box flex={1} mr={3}>
          <Text typography="Body2Strong">{label}</Text>
          <Box flexDirection="row">
            <Text typography="Body2" color="text-subdued">
              {address}
            </Text>
            <Box w={1} h={1} m={2} bgColor="icon-disabled" rounded="full" />
            <Text typography="Body2" color="text-subdued" isTruncated>
              {balance}
            </Text>
          </Box>
        </Box>
        <IconButton name="EllipsisVerticalMini" type="plain" circle />
      </Box>
    )}
  </Pressable>
);

ListItem.defaultProps = defaultProps;

export default ListItem;
