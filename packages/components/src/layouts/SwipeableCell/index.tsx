import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import type { ForwardedRef } from 'react';

import { usePropsAndStyle } from '@tamagui/core';
import { Animated } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';

import { SizableText } from '../../primitives/SizeableText';
import { Stack, XStack } from '../../primitives/Stack';

import type { StackStyleProps } from '@tamagui/web/types/types';
import type { ColorTokens, GetProps } from 'tamagui';

type ISwipeableCellItemProps = {
  title: string;
  width: number;
  backgroundColor: ColorTokens;
  onPress: ({ close }: { close?: () => void }) => void;
};

type ISwipeableSwipeDirection = 'left' | 'right';

type ISwipeableSwipeProgress = Animated.AnimatedInterpolation<string | number>;

function SwipeableCellContainer({
  close,
  progress,
  isRightDirection,
  itemList,
}: {
  close?: () => void;
  progress: ISwipeableSwipeProgress;
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
            key={index}
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
              <SizableText color="white">{item.title}</SizableText>
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
  const onSwipeableOpen = useCallback(
    (direction: ISwipeableSwipeDirection, swipeable: Swipeable) => {
      restProps?.onSwipeableOpen?.(direction, swipeable);
      LAST_SWIPED_CELL_CLOSE = innerRef?.current?.close;
    },
    [restProps],
  );
  const onSwipeableWillOpen = useCallback(
    (direction: ISwipeableSwipeDirection) => {
      restProps?.onSwipeableWillOpen?.(direction);
      if (LAST_SWIPED_CELL_CLOSE !== innerRef?.current?.close) {
        LAST_SWIPED_CELL_CLOSE?.();
      }
    },
    [restProps],
  );
  const renderActionList = useCallback(
    (progress: ISwipeableSwipeProgress, isRightDirection: boolean) => (
      <SwipeableCellContainer
        progress={progress}
        itemList={!isRightDirection ? leftItemList : rightItemList}
        isRightDirection={isRightDirection}
        close={innerRef?.current?.close}
      />
    ),
    [leftItemList, rightItemList],
  );
  const renderLeftActionList = useCallback(
    (progress: ISwipeableSwipeProgress) => renderActionList(progress, false),
    [renderActionList],
  );
  const renderRightActionList = useCallback(
    (progress: ISwipeableSwipeProgress) => renderActionList(progress, true),
    [renderActionList],
  );
  return (
    <Swipeable
      ref={innerRef}
      friction={1}
      dragOffsetFromLeftEdge={20}
      enableTrackpadTwoFingerGesture
      overshootLeft={false}
      overshootRight={false}
      enabled={swipeEnabled}
      renderLeftActions={renderLeftActionList}
      renderRightActions={renderRightActionList}
      style={style}
      {...restProps}
      onSwipeableOpen={onSwipeableOpen}
      onSwipeableWillOpen={onSwipeableWillOpen}
    />
  );
}

export const SwipeableCell = forwardRef(
  BaseSwipeableCell,
) as typeof BaseSwipeableCell;
