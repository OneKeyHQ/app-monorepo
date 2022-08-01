import React, { FC } from 'react';

import { IBoxProps } from 'native-base';

import {
  Box,
  Hidden,
  ICON_NAMES,
  Icon,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

type PressableListItemProps = {
  icon: ICON_NAMES;
  label: string;
  onPress?: () => void;
} & IBoxProps;

const PressableListItem: FC<PressableListItemProps> = ({
  icon,
  label,
  onPress,
  children,
  ...rest
}) => {
  const isVerticalLayout = useIsVerticalLayout();

  return (
    <Pressable
      flex={{ sm: 1 }}
      flexDir={{ base: 'row', sm: 'column' }}
      mx={2}
      px={{ base: 3, sm: 6 }}
      py={{ base: 4, sm: 6 }}
      // @ts-expect-error
      bgColor="surface-default"
      _hover={{ bgColor: 'surface-hovered' }}
      _pressed={{ bgColor: 'surface-pressed' }}
      borderWidth={1}
      borderColor="divider"
      rounded="xl"
      onPress={onPress}
      {...rest}
    >
      <Box mr={3}>
        <Icon
          size={isVerticalLayout ? 24 : 32}
          name={icon}
          color="interactive-default"
        />
      </Box>
      <Text
        flex={1}
        mt={{ sm: 8 }}
        typography={{ sm: 'Body1Strong', md: 'DisplayMedium' }}
      >
        {label}
      </Text>
      <Hidden from="sm">
        <Box py={0.5}>
          <Icon name="ChevronRightSolid" size={20} />
        </Box>
      </Hidden>
      {children}
    </Pressable>
  );
};

export default PressableListItem;
