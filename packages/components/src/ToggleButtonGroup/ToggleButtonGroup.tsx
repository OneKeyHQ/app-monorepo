import { FC, ReactElement } from 'react';

import { IBoxProps } from 'native-base';
import { LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';

import {
  Center,
  ICON_NAMES,
  Icon,
  NetImage,
  Pressable,
  Typography,
} from '@onekeyhq/components';

import ScrollableButtonGroup from '../ScrollableButtonGroup/ScrollableButtonGroup';

export interface ToggleButtonProps {
  text: string;
  leftIcon?: ICON_NAMES;
  leftImage?: string;
  leftComponentRender?: () => ReactElement;
}

interface ToggleButtonGroupProps {
  buttons: ToggleButtonProps[];
  selectedIndex: number;
  onButtonPress: (index: number) => void;
  leftIconSize?: number;
  size?: 'sm' | 'lg';
  bg?: IBoxProps['bg'];
  maxTextWidth?: number | string;
}
const ToggleButton: FC<
  ToggleButtonProps & {
    isCurrent?: boolean;
    onPress: () => void;
    leftIconSize?: number | string;
    onLayout?: (e: LayoutChangeEvent) => void;
    size?: 'sm' | 'lg';
    maxTextWidth?: number | string;
  }
> = ({
  text,
  leftIcon,
  leftImage,
  leftComponentRender,
  isCurrent,
  onPress,
  leftIconSize,
  onLayout,
  size,
  maxTextWidth,
}) => {
  const isSmall = size === 'sm';
  const iconSize = leftIconSize || (isSmall ? '16px' : '20px');
  return (
    <Pressable
      _hover={{
        bg: 'surface-selected',
      }}
      h={isSmall ? '32px' : '36px'}
      px={isSmall ? '8px' : '12px'}
      py={isSmall ? '6px' : '8px'}
      mr="8px"
      bg={isCurrent ? 'surface-selected' : 'transparent'}
      borderRadius="9999px"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      onPress={onPress}
      onLayout={onLayout}
    >
      {(!!leftIcon || !!leftImage) && (
        <Center
          borderRadius="9999px"
          w={iconSize}
          h={iconSize}
          mr={isSmall ? '4px' : '8px'}
        >
          {!!leftIcon && (
            <Icon
              name={leftIcon}
              color={isCurrent ? 'icon-hovered' : 'icon-default'}
            />
          )}
          {!!leftImage && (
            <NetImage height={iconSize} width={iconSize} src={leftImage} />
          )}
        </Center>
      )}
      {leftComponentRender?.()}
      <Typography.Body2Strong
        maxW={maxTextWidth}
        isTruncated
        color={isCurrent ? 'text-default' : 'text-subdued'}
      >
        {text}
      </Typography.Body2Strong>
    </Pressable>
  );
};

const ToggleButtonGroup: FC<ToggleButtonGroupProps> = ({
  buttons,
  selectedIndex,
  onButtonPress,
  size = 'sm',
  bg = 'surface-default',
  maxTextWidth,
}) => {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  return (
    <ScrollableButtonGroup
      bg={bg}
      overflow="hidden"
      w="full"
      flexDirection="row"
      alignItems="center"
      position="relative"
      selectedIndex={selectedIndex}
      ref={scrollRef}
    >
      {buttons.map((btn, index) => (
        <ToggleButton
          key={index}
          isCurrent={selectedIndex === index}
          {...btn}
          size={size}
          maxTextWidth={maxTextWidth}
          onPress={() => {
            onButtonPress(index);
          }}
        />
      ))}
    </ScrollableButtonGroup>
  );
};
ToggleButtonGroup.displayName = 'ToggleButtonGroup';

export default ToggleButtonGroup;
