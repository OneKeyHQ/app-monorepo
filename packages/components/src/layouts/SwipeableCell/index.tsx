import {
  forwardRef,
  ReactElement,
  useCallback,
  useImperativeHandle,
  useRef,
} from 'react';
import type { ForwardedRef } from 'react';
import { useIntl } from 'react-intl';
import { Animated } from 'react-native';

import Swipeable from 'react-native-gesture-handler/Swipeable';
import { RectButton } from 'react-native-gesture-handler';

import { Stack, XStack } from '../../primitives/Stack';
import { Text } from '../../primitives/Text';

import type { GetProps, ColorTokens } from 'tamagui';
import type { StackProps } from '@tamagui/web/types/types';

let LAST_OPENED_CELL_CLOSE_FUNCTION: () => void;

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

export type ISwipeableCellProps = GetProps<typeof Swipeable> & {
  swipeEnabled?: boolean;
  rightItemList?: Array<ISwipeableCellItemProps>;
  leftItemList?: Array<ISwipeableCellItemProps>;
};

function BaseSwipeableCell(
  {
    swipeEnabled = true,
    rightItemList = [],
    leftItemList = [],
    ...rest
  }: ISwipeableCellProps,
  ref: ForwardedRef<Swipeable>,
) {
  const innerRef = useRef<Swipeable>(null);
  useImperativeHandle(
    ref as any,
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
      {...rest}
    />
  );
}

export const SwipeableCell = forwardRef(
  BaseSwipeableCell,
) as typeof BaseSwipeableCell;
