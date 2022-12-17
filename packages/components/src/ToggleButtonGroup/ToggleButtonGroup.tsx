import type { FC, ReactElement } from 'react';
import { useMemo } from 'react';

import type { ICON_NAMES } from '@onekeyhq/components';
import {
  Center,
  HStack,
  Icon,
  NetImage,
  Pressable,
  Typography,
} from '@onekeyhq/components';

import ScrollableButtonGroup from '../ScrollableButtonGroup/ScrollableButtonGroup';

import type { ThemeToken } from '../Provider/theme';
import type { ScrollableButtonGroupProps } from '../ScrollableButtonGroup/ScrollableButtonGroup';
import type { IBoxProps } from 'native-base';
import type { LayoutChangeEvent } from 'react-native';

export interface ToggleButtonProps {
  text: string;
  leftIcon?: ICON_NAMES;
  leftIconSelectedColor?: ThemeToken;
  leftImage?: string;
  leftComponentRender?: () => ReactElement;
}

interface ToggleButtonGroupProps extends ScrollableButtonGroupProps {
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
  leftIconSelectedColor,
}) => {
  const isSmall = size === 'sm';
  const iconSize = leftIconSize || (isSmall ? '16px' : '20px');
  const selectedIconColor = leftIconSelectedColor || 'icon-hovered';
  const iconTextSpace = useMemo(() => {
    let mr = '0px';
    if (text.length > 0) {
      mr = isSmall ? '4px' : '8px';
    }
    return mr;
  }, [isSmall, text.length]);
  return (
    <Pressable mr="8px" onPress={onPress} onLayout={onLayout}>
      {({ isHovered, isPressed }) => {
        const toggleButtonBg = () => {
          if (isCurrent) return 'surface-selected';
          if (isPressed) return 'surface-pressed';
          if (isHovered) return 'surface-hovered';
          return 'transparent';
        };

        return (
          <HStack
            alignItems="center"
            h={isSmall ? '32px' : '36px'}
            px={isSmall ? '8px' : '12px'}
            py={isSmall ? '6px' : '8px'}
            borderRadius="9999px"
            bg={toggleButtonBg()}
          >
            {(!!leftIcon || !!leftImage) && (
              <Center
                borderRadius="9999px"
                w={iconSize}
                h={iconSize}
                mr={iconTextSpace}
              >
                {!!leftIcon && (
                  <Icon
                    name={leftIcon}
                    color={isCurrent ? selectedIconColor : 'icon-default'}
                  />
                )}
                {!!leftImage && (
                  <NetImage
                    height={iconSize}
                    width={iconSize}
                    src={leftImage}
                  />
                )}
              </Center>
            )}
            {leftComponentRender?.()}
            {text.length > 0 ? (
              <Typography.Body2Strong
                maxW={maxTextWidth}
                isTruncated
                color={isCurrent ? 'text-default' : 'text-subdued'}
              >
                {text}
              </Typography.Body2Strong>
            ) : null}
          </HStack>
        );
      }}
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
  ...rest
}) => (
  <ScrollableButtonGroup
    bg={bg}
    overflow="hidden"
    w="full"
    flexDirection="row"
    alignItems="center"
    position="relative"
    selectedIndex={selectedIndex}
    {...rest}
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
ToggleButtonGroup.displayName = 'ToggleButtonGroup';

export default ToggleButtonGroup;
