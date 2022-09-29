/* eslint-disable react/prop-types */
/* eslint-disable no-nested-ternary */
import React, { ComponentProps, FC } from 'react';

import { HStack, Pressable } from '@onekeyhq/components';

import Column from './Column';

type ListItemProps = {
  onPress?: () => void;
} & ComponentProps<typeof HStack>;

const defaultProps = {} as const;
type TListItem = FC<ListItemProps> & { Column: typeof Column };

const ListItem: TListItem = ({ onPress, children, ...rest }) => (
  <>
    {onPress ? (
      <Pressable>
        {({ isHovered, isPressed }) => (
          <HStack
            p={2}
            space={4}
            alignItems="center"
            borderRadius="xl"
            bgColor={
              isPressed
                ? 'surface-pressed'
                : isHovered
                ? 'surface-hovered'
                : undefined
            }
            {...rest}
          >
            {children}
          </HStack>
        )}
      </Pressable>
    ) : (
      <HStack alignItems="center" p={2} space={4} {...rest}>
        {children}
      </HStack>
    )}
  </>
);

ListItem.defaultProps = defaultProps;
ListItem.Column = Column;

export default ListItem;
