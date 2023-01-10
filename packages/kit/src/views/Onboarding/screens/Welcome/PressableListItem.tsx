import type { FC } from 'react';

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
  onPress?: () => void;
} & IBoxProps;

const PressableListItem: FC<PressableListItemProps> = ({
  icon,
  label,
  description,
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
        mt={{ sm: 6 }}
        typography={{ sm: 'Body1Strong', md: 'DisplayMedium' }}
      >
        {label}
      </Text>
      <Hidden till="sm">
        <Text
          flex={1}
          mt={{ sm: 2 }}
          typography={{ sm: 'Body2', md: 'Body2' }}
          color="text-subdued"
        >
          {description}
        </Text>
      </Hidden>
      {children}
      <Hidden from="sm">
        <Box py={0.5}>
          <Icon name="ChevronRightMini" size={20} color="icon-subdued" />
        </Box>
      </Hidden>
    </Pressable>
  );
};

export default PressableListItem;
