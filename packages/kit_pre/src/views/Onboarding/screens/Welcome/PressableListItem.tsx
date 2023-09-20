import type { FC } from 'react';

import { StyleSheet } from 'react-native';

import type { ICON_NAMES } from '@onekeyhq/components';
import {
  Box,
  Hidden,
  Icon,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import type { IBoxProps } from 'native-base';

type PressableListItemProps = {
  icon: ICON_NAMES;
  label: string;
  description: string;
  isDisabled?: boolean;
  onPress?: () => void;
} & IBoxProps;

const PressableListItem: FC<PressableListItemProps> = ({
  icon,
  label,
  description,
  onPress,
  isDisabled,
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
      bgColor="action-secondary-default"
      _hover={{ bgColor: 'action-secondary-hovered' }}
      _pressed={{ bgColor: 'action-secondary-pressed' }}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="border-default"
      rounded="xl"
      onPress={onPress}
      disabled={isDisabled}
      {...rest}
    >
      <Box mr={3}>
        <Icon
          size={isVerticalLayout ? 24 : 28}
          name={icon}
          color={isDisabled ? 'icon-disabled' : 'interactive-default'}
        />
      </Box>
      <Text
        flex={{ sm: undefined, base: 1 }}
        mt={{ sm: 6 }}
        typography={{ sm: 'Body1Strong', md: 'DisplayMedium' }}
        color={isDisabled ? 'text-disabled' : 'text-default'}
      >
        {label}
      </Text>
      <Hidden till="sm">
        <Text
          flex={1}
          mt={{ sm: 2 }}
          typography={{ sm: 'Body2', md: 'Body2' }}
          color={isDisabled ? 'text-disabled' : 'text-subdued'}
        >
          {description}
        </Text>
      </Hidden>
      {children}
      <Hidden from="sm">
        <Box py={0.5}>
          <Icon
            name="ChevronRightMini"
            size={20}
            color={isDisabled ? 'icon-disabled' : 'icon-subdued'}
          />
        </Box>
      </Hidden>
    </Pressable>
  );
};

export default PressableListItem;
