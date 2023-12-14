import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { ForwardedRef } from 'react';

import { usePropsAndStyle } from '@tamagui/core';
import { Animated } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';

import { Stack, XStack } from '../../primitives/Stack';
import { Text } from '../../primitives/Text';

import type { StackStyleProps } from '@tamagui/web/types/types';
import type { ColorTokens, GetProps } from 'tamagui';

type ISwipeableCellItemProps = {
  title: string;
  width: number;
  backgroundColor: ColorTokens;
  onPress: ({ close }: { close?: () => void }) => void;
};

function SwipeableCellContainer({
  close,
  progress,
  isRightDirection,
  itemList,
}: {
  close?: () => void;
  progress: Animated.AnimatedInterpolation<string | number>;
  isRightDirection: boolean;
  itemList: Array<ISwipeableCellItemProps>;
}) {
  return (
    <XStack>
      {itemList.map((item, index) => {
        const x = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [
            itemList
              .slice(
                isRightDirection ? index : 0,
                isRightDirection ? itemList.length : index + 1,
              )
              .map((_item) => _item.width)
              .reduce((previous, current) => previous + current, 0) *
              (isRightDirection ? 1 : -1),
            0,
          ],
        });
        return (
          <Animated.View
            style={{
              zIndex: isRightDirection ? index : itemList.length - index,
              transform: [
                {
                  translateX: x,
                },
              ],
            }}
          >
            <Stack
              bg={item.backgroundColor}
              w={item.width}
              h="100%"
              justifyContent="center"
              alignItems="center"
              onPress={() => item.onPress({ close })}
            >
              <Text color="white">{item.title}</Text>
            </Stack>
          </Animated.View>
        );
      })}
    </XStack>
  );
}

export type ISwipeableCellRef = {
  close: () => void;
};

export type ISwipeableCellProps = GetProps<typeof Swipeable> &
  StackStyleProps & {
    swipeEnabled?: boolean;
    rightItemList?: Array<ISwipeableCellItemProps>;
    leftItemList?: Array<ISwipeableCellItemProps>;
  };

let LAST_SWIPED_CELL_CLOSE: (() => void) | undefined;

function BaseSwipeableCell(
  {
    swipeEnabled = true,
    rightItemList = [],
    leftItemList = [],
    ...props
  }: ISwipeableCellProps,
  ref: ForwardedRef<ISwipeableCellRef>,
) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  const innerRef = useRef<Swipeable>(null);
  useImperativeHandle(
    ref,
    () => ({
      close: () => {
        innerRef?.current?.close();
      },
    }),
    [],
  );
  if (!swipeEnabled) {
    innerRef?.current?.close();
  }
  return (
    <Swipeable
      ref={innerRef}
      friction={2}
      enableTrackpadTwoFingerGesture
      overshootLeft={false}
      overshootRight={false}
      enabled={swipeEnabled}
      renderLeftActions={(progress) => (
        <SwipeableCellContainer
          progress={progress}
          itemList={leftItemList}
          isRightDirection={false}
          close={innerRef?.current?.close}
        />
      )}
      renderRightActions={(progress) => (
        <SwipeableCellContainer
          progress={progress}
          itemList={rightItemList}
          isRightDirection
          close={innerRef?.current?.close}
        />
      )}
      style={style}
      {...restProps}
      onSwipeableOpen={(direction, swipeable) => {
        restProps?.onSwipeableOpen?.(direction, swipeable);
        LAST_SWIPED_CELL_CLOSE = innerRef?.current?.close;
      }}
      onSwipeableWillOpen={(direction) => {
        restProps?.onSwipeableWillOpen?.(direction);
        if (LAST_SWIPED_CELL_CLOSE !== innerRef?.current?.close) {
          LAST_SWIPED_CELL_CLOSE?.();
        }
      }}
    />
  );
}

export const SwipeableCell = forwardRef(
  BaseSwipeableCell,
) as typeof BaseSwipeableCell;
