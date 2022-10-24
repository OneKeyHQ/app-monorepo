import { FC, ReactElement, useCallback, useEffect, useRef } from 'react';

import { IBoxProps } from 'native-base';
import { LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import {
  Box,
  Center,
  ICON_NAMES,
  Icon,
  IconButton,
  NetImage,
  Pressable,
  Typography,
} from '@onekeyhq/components';

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
    onLayout: (e: LayoutChangeEvent) => void;
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
  const showLeftArrow = useSharedValue(false);
  const showRightArrow = useSharedValue(false);
  const currentOffsetX = useSharedValue(0);
  const containerWidth = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(
    ({ contentOffset, contentSize }) => {
      currentOffsetX.value = contentOffset.x;
      showLeftArrow.value = contentOffset.x > 0;
      showRightArrow.value =
        Math.floor(contentSize.width - contentOffset.x) > containerWidth.value;
    },
    [],
  );
  const buttonLayouts = useRef<{ x: number; width: number }[]>([]);
  const lastestTodoScrollIndex = useRef<number>();
  const scrollTo = useCallback(
    (index: number) => {
      if (scrollRef.current) {
        const target = buttonLayouts.current[index === 0 ? 0 : index - 1];
        if (target) {
          lastestTodoScrollIndex.current = undefined;
          return scrollRef.current.scrollTo({
            x: target.x,
            animated: true,
          });
        }
      }
      // ref or layout not ready, record the index and scroll to it later
      lastestTodoScrollIndex.current = index;
    },
    [scrollRef],
  );

  useEffect(() => {
    // reset layouts
    buttonLayouts.current = [];
    lastestTodoScrollIndex.current = undefined;
  }, [buttons.length]);

  useEffect(() => {
    scrollTo(selectedIndex);
  }, [scrollTo, selectedIndex]);

  return (
    <Box
      bg={bg}
      borderRadius="12"
      overflow="hidden"
      w="full"
      flexDirection="row"
      alignItems="center"
      position="relative"
      onLayout={({
        nativeEvent: {
          layout: { width },
        },
      }) => {
        containerWidth.value = width;
      }}
    >
      <Animated.View
        style={[
          { position: 'absolute' },
          useAnimatedStyle(
            () => ({
              opacity: showLeftArrow.value ? 1 : 0,
              zIndex: showLeftArrow.value ? 1 : -1,
            }),
            [],
          ),
        ]}
      >
        <Center bg={bg}>
          <IconButton
            onPress={() => {
              scrollRef.current?.scrollTo({
                x: currentOffsetX.value - containerWidth.value || 0,
                animated: true,
              });
            }}
            type="plain"
            size={size}
            name="ChevronLeftSolid"
          />
        </Center>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        style={{
          flex: 1,
        }}
        horizontal
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
      >
        {buttons.map((btn, index) => (
          <ToggleButton
            key={index}
            isCurrent={selectedIndex === index}
            {...btn}
            size={size}
            maxTextWidth={maxTextWidth}
            onPress={() => {
              scrollTo(index);
              onButtonPress(index);
            }}
            onLayout={({
              nativeEvent: {
                layout: { width, x },
              },
            }) => {
              const layouts = buttonLayouts.current;
              layouts[index] = { x, width };
              if (
                layouts.length === buttons.length &&
                lastestTodoScrollIndex.current !== undefined
              ) {
                // layouts all ready, scroll to the lastest todo index
                scrollTo(lastestTodoScrollIndex.current);
              }
            }}
          />
        ))}
      </Animated.ScrollView>
      <Animated.View
        style={[
          { position: 'absolute', right: 0 },
          useAnimatedStyle(
            () => ({
              opacity: showRightArrow.value ? 1 : 0,
              zIndex: showRightArrow.value ? 1 : -1,
            }),
            [],
          ),
        ]}
      >
        <Center bg={bg}>
          <IconButton
            onPress={() => {
              scrollRef.current?.scrollTo({
                x: currentOffsetX.value + containerWidth.value,
                animated: true,
              });
            }}
            type="plain"
            size={size}
            name="ChevronRightSolid"
          />
        </Center>
      </Animated.View>
    </Box>
  );
};
ToggleButtonGroup.displayName = 'ToggleButtonGroup';

export default ToggleButtonGroup;
