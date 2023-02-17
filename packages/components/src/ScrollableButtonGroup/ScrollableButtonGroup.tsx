import type { ComponentProps, ReactElement } from 'react';
import {
  Children,
  cloneElement,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Box, Center, IconButton } from '@onekeyhq/components';

import { useForwardRef } from '../utils/useForwardRef';

import type { IBoxProps } from 'native-base';

export interface ScrollableButtonGroupProps extends IBoxProps {
  selectedIndex?: number;
  renderLeftArrow?: ({ onPress }: { onPress: () => void }) => ReactElement;
  renderRightArrow?: ({ onPress }: { onPress: () => void }) => ReactElement;
  leftButtonProps?: Partial<ComponentProps<typeof IconButton>>;
  rightButtonProps?: Partial<ComponentProps<typeof IconButton>>;
}
const ScrollableButtonGroup = forwardRef<
  Animated.ScrollView,
  ScrollableButtonGroupProps
>(
  (
    {
      children,
      renderLeftArrow,
      renderRightArrow,
      bg = 'surface-default',
      selectedIndex,
      leftButtonProps,
      rightButtonProps,
      ...boxProps
    },
    ref,
  ) => {
    const scrollRef = useForwardRef(ref);
    const showLeftArrow = useSharedValue(false);
    const showRightArrow = useSharedValue(false);
    const currentOffsetX = useSharedValue(0);
    const containerWidth = useSharedValue(0);
    const contentWidth = useSharedValue(0);
    const onContentSizeChange = useCallback((_contentWidth: number) => {
      contentWidth.value = _contentWidth;
      if (containerWidth.value) {
        showRightArrow.value =
          Math.floor(contentWidth.value - currentOffsetX.value) >
          containerWidth.value;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const onScroll = useAnimatedScrollHandler(
      ({ contentOffset, contentSize }) => {
        currentOffsetX.value = contentOffset.x;
        showLeftArrow.value = currentOffsetX.value > 0;
        showRightArrow.value =
          Math.floor(contentSize.width - currentOffsetX.value) >
          containerWidth.value;
      },
      [],
    );
    const itemLayouts = useRef<{ x: number; width: number }[]>([]);
    const scrollLayoutWidth = useRef(0);
    const lastestTodoScrollIndex = useRef<number>();
    const scrollTo = useCallback(
      (index: number) => {
        if (scrollRef.current) {
          const curentTarget = itemLayouts.current[index];
          if (curentTarget && scrollLayoutWidth.current) {
            const scrollToX =
              curentTarget.x +
              curentTarget.width / 2 -
              scrollLayoutWidth.current / 2;
            lastestTodoScrollIndex.current = undefined;
            return scrollRef.current.scrollTo({
              x: scrollToX,
              animated: true,
            });
          }
        }
        // ref or layout not ready, record the index and scroll to it later
        lastestTodoScrollIndex.current = index;
        // eslint-disable-next-line react-hooks/exhaustive-deps
      },
      [scrollRef],
    );

    const itemCount = Children.count(children);

    useEffect(() => {
      // reset layouts
      itemLayouts.current = [];
      lastestTodoScrollIndex.current = undefined;
    }, [itemCount]);

    useEffect(() => {
      if (selectedIndex !== undefined) {
        scrollTo(selectedIndex);
      }
    }, [scrollTo, selectedIndex]);

    const onLeftArrowPress = useCallback(() => {
      scrollRef.current?.scrollTo({
        x: currentOffsetX.value - containerWidth.value || 0,
        animated: true,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onRightArrowPress = useCallback(() => {
      scrollRef.current?.scrollTo({
        x: currentOffsetX.value + containerWidth.value,
        animated: true,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onContainerLayout = useCallback(
      ({
        nativeEvent: {
          layout: { width },
        },
      }) => {
        containerWidth.value = width;
        showRightArrow.value =
          Math.floor(contentWidth.value - currentOffsetX.value) >
          containerWidth.value;
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

    return (
      <Box bg={bg} {...boxProps} onLayout={onContainerLayout}>
        <Animated.View
          style={[
            { position: 'absolute' },
            useAnimatedStyle(
              () => ({
                opacity: withTiming(showLeftArrow.value ? 1 : 0, {
                  duration: 300,
                }),
                scale: withTiming(showLeftArrow.value ? 1 : 0, {
                  duration: 300,
                }),
                zIndex: withTiming(showLeftArrow.value ? 1 : -1, {
                  duration: 300,
                }),
              }),
              [],
            ),
          ]}
        >
          <Center bg={bg}>
            {renderLeftArrow ? (
              renderLeftArrow({ onPress: onLeftArrowPress })
            ) : (
              <IconButton
                type="plain"
                circle
                name="ChevronLeftMini"
                size="sm"
                onPress={onLeftArrowPress}
                {...leftButtonProps}
              />
            )}
          </Center>
        </Animated.View>

        <Animated.ScrollView
          ref={scrollRef}
          onLayout={({
            nativeEvent: {
              layout: { width },
            },
          }) => {
            scrollLayoutWidth.current = width;
            if (lastestTodoScrollIndex.current) {
              scrollTo(lastestTodoScrollIndex.current);
            }
          }}
          style={{
            flex: 1,
          }}
          horizontal
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={onContentSizeChange}
        >
          {Children.map(children, (child, index) =>
            cloneElement(child, {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              ...child.props,
              onPress: () => {
                scrollTo(index);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                child.props.onPress?.();
              },
              onLayout: ({
                nativeEvent: {
                  // @ts-ignore
                  layout: { width, x },
                },
              }) => {
                const layouts = itemLayouts.current;
                layouts[index] = { x, width };
                // if (
                //   layouts.length === itemCount &&
                //   lastestTodoScrollIndex.current !== undefined
                // ) {
                //   // layouts all ready, scroll to the lastest todo index
                //   scrollTo(lastestTodoScrollIndex.current);
                // }
              },
            }),
          )}
        </Animated.ScrollView>
        <Animated.View
          style={[
            { position: 'absolute', right: 0 },
            useAnimatedStyle(
              () => ({
                opacity: withTiming(showRightArrow.value ? 1 : 0, {
                  duration: 300,
                }),
                scale: withTiming(showRightArrow.value ? 1 : 0, {
                  duration: 300,
                }),
                zIndex: withTiming(showRightArrow.value ? 1 : -1, {
                  duration: 300,
                }),
              }),
              [],
            ),
          ]}
        >
          <Center bg={bg}>
            {renderRightArrow ? (
              renderRightArrow({ onPress: onRightArrowPress })
            ) : (
              <IconButton
                type="plain"
                circle
                name="ChevronRightMini"
                size="sm"
                onPress={onRightArrowPress}
                {...rightButtonProps}
              />
            )}
          </Center>
        </Animated.View>
      </Box>
    );
  },
);
ScrollableButtonGroup.displayName = 'ScrollableButtonGroup';

export default ScrollableButtonGroup;
