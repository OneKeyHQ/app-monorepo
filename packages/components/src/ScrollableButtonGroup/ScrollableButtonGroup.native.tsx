import {
  Children,
  cloneElement,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import Animated from 'react-native-reanimated';

import { Box } from '@onekeyhq/components';

import { useForwardRef } from '../utils/useForwardRef';

import type { IBoxProps } from 'native-base';

export interface ScrollableButtonGroupProps extends IBoxProps {
  selectedIndex?: number;
}
const ScrollableButtonGroup = forwardRef<
  Animated.ScrollView,
  ScrollableButtonGroupProps
>(({ children, bg = 'surface-default', selectedIndex, ...boxProps }, ref) => {
  const scrollRef = useForwardRef(ref);
  const scrollLayoutWidth = useRef(0);
  const itemLayouts = useRef<{ x: number; width: number }[]>([]);
  const lastestTodoScrollIndex = useRef<number>();
  const scrollTo = useCallback(
    (index: number) => {
      // if (index === selectedIndex) return;
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

  return (
    <Box bg={bg} {...boxProps}>
      <Animated.ScrollView
        ref={scrollRef}
        onLayout={({
          nativeEvent: {
            layout: { width },
          },
        }) => {
          scrollLayoutWidth.current = width;
        }}
        style={{
          flex: 1,
        }}
        horizontal
        showsHorizontalScrollIndicator={false}
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
    </Box>
  );
});
ScrollableButtonGroup.displayName = 'ScrollableButtonGroup';

export default ScrollableButtonGroup;
