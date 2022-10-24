import {
  Children,
  ComponentProps,
  ReactElement,
  cloneElement,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import { IBoxProps } from 'native-base';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { Box, Center, IconButton } from '@onekeyhq/components';

import { useForwardRef } from '../utils/useForwardRef';

export interface ScrollableButtonGroupProps extends IBoxProps {
  selectedIndex: number;
  renderLeftArrow?: ({ onPress }: { onPress: () => void }) => ReactElement;
  renderRightArrow?: ({ onPress }: { onPress: () => void }) => ReactElement;
  leftButtonProps?: ComponentProps<typeof IconButton>;
  rightButtonProps?: ComponentProps<typeof IconButton>;
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
    const onContentSizeChange = useCallback(
      (contentWidth: number) => {
        showRightArrow.value =
          Math.floor(contentWidth - currentOffsetX.value) >
          containerWidth.value;
      },
      [containerWidth.value, currentOffsetX.value, showRightArrow],
    );
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
    const lastestTodoScrollIndex = useRef<number>();
    const scrollTo = useCallback(
      (index: number) => {
        if (scrollRef.current) {
          const target = itemLayouts.current[index === 0 ? 0 : index - 1];
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

    const itemCount = Children.count(children);

    useEffect(() => {
      // reset layouts
      itemLayouts.current = [];
      lastestTodoScrollIndex.current = undefined;
    }, [itemCount]);

    useEffect(() => {
      scrollTo(selectedIndex);
    }, [scrollTo, selectedIndex]);

    const onLeftArrowPress = useCallback(() => {
      scrollRef.current?.scrollTo({
        x: currentOffsetX.value - containerWidth.value || 0,
        animated: true,
      });
    }, [currentOffsetX.value, containerWidth.value, scrollRef]);

    const onRightArrowPress = useCallback(() => {
      scrollRef.current?.scrollTo({
        x: currentOffsetX.value + containerWidth.value,
        animated: true,
      });
    }, [currentOffsetX.value, containerWidth.value, scrollRef]);

    return (
      <Box
        bg={bg}
        {...boxProps}
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
            {renderLeftArrow ? (
              renderLeftArrow({ onPress: onLeftArrowPress })
            ) : (
              <IconButton
                type="plain"
                name="ChevronLeftSolid"
                size="sm"
                onPress={onLeftArrowPress}
                {...leftButtonProps}
              />
            )}
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
                if (
                  layouts.length === itemCount &&
                  lastestTodoScrollIndex.current !== undefined
                ) {
                  // layouts all ready, scroll to the lastest todo index
                  scrollTo(lastestTodoScrollIndex.current);
                }
              },
            }),
          )}
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
            {renderRightArrow ? (
              renderRightArrow({ onPress: onRightArrowPress })
            ) : (
              <IconButton
                type="plain"
                name="ChevronRightSolid"
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
