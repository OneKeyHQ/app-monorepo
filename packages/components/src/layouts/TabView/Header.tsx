import { forwardRef, useCallback, useMemo, useRef } from 'react';
import type { ForwardedRef } from 'react';

import { PageHeaderView } from '@onekeyfe/react-native-tab-page-view';
import { useProps, useStyle } from '@tamagui/core';
import { Pressable, StyleSheet } from 'react-native';

import { useThemeValue } from '../../hooks';
import { Icon } from '../../primitives';

import type { StackStyleProps, TextStyleProps } from '@tamagui/web/types/types';
import type { NativeScrollEvent, View } from 'react-native';
import type { GetProps } from 'tamagui';

export type IHeaderProps = Omit<
  GetProps<typeof PageHeaderView>,
  | 'style'
  | 'itemContainerStyle'
  | 'itemTitleStyle'
  | 'itemTitleNormalStyle'
  | 'itemTitleSelectedStyle'
  | 'cursorStyle'
> &
  StackStyleProps & {
    style?: StackStyleProps;
    contentContainerStyle?: StackStyleProps;
    scrollContainerStyle?: StackStyleProps;
    containerStyle?: StackStyleProps;
    itemContainerStyle?: StackStyleProps;
    itemTitleStyle?: TextStyleProps;
    itemTitleNormalStyle?: TextStyleProps & { color: string };
    itemTitleSelectedStyle?: TextStyleProps & { color: string };
    cursorStyle?: StackStyleProps;
    showHorizontalScrollButton?: boolean;
  };

const HeaderComponent = (
  {
    style,
    titleFromItem = (item: { title: string }) => item.title,
    contentContainerStyle = {},
    scrollContainerStyle = {},
    containerStyle = {},
    itemContainerStyle = { ml: '$5', pb: '$0.5', cursor: 'default' },
    itemTitleStyle = { fontSize: 16, fontWeight: '500' },
    itemTitleNormalStyle = { color: '$textSubdued' },
    itemTitleSelectedStyle = { color: '$text' },
    cursorStyle = {
      bottom: -StyleSheet.hairlineWidth * 2,
      h: '$1',
      bg: '$bgPrimary',
    },
    showHorizontalScrollButton,
    ...props
  }: IHeaderProps,
  ref: ForwardedRef<PageHeaderView>,
) => {
  const scrollValue = useRef<
    Omit<NativeScrollEvent, 'contentInset' | 'zoomScale'>
  >({
    layoutMeasurement: { width: 0, height: 0 },
    contentOffset: { x: 0, y: 0 },
    contentSize: { width: 0, height: 0 },
  });
  const leftArrowRef = useRef<View>(null);
  const rightArrowRef = useRef<View>(null);
  const normalColor = itemTitleNormalStyle.color;
  const selectedColor = itemTitleSelectedStyle.color;
  const [rawNormalColor, rawSelectedColor] = useThemeValue(
    [normalColor, selectedColor],
    undefined,
    true,
  );
  const rawStyle = useStyle(
    {
      ...(props.data.length > 0
        ? {
            h: '$11',
            bg: '$bgApp',
            borderBottomColor: '$borderSubdued',
            borderBottomWidth: StyleSheet.hairlineWidth,
          }
        : {}),
      ...style,
    } as Record<string, unknown>,
    {
      resolveValues: 'value',
    },
  );
  const data = useMemo(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    () => [...props.data],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.data, rawStyle],
  );
  const reloadWebPxNumber = useCallback((value: any) => {
    if (typeof value === 'string') {
      const number = value.match(/(\d+(\.\d+)?)px/)?.[1];
      if (number) {
        return Number(number);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value;
  }, []);

  const rawProps = useProps(props, {
    resolveValues: 'value',
  });
  const rawContentContainerStyle = useStyle(
    contentContainerStyle as Record<string, unknown>,
    {
      resolveValues: 'value',
    },
  );
  const rawScrollContainerStyle = useStyle(
    scrollContainerStyle as Record<string, unknown>,
    {
      resolveValues: 'value',
    },
  );
  const rawContainerStyle = useStyle(
    containerStyle as Record<string, unknown>,
    {
      resolveValues: 'value',
    },
  );
  const rawItemContainerStyle = {
    ...useStyle(itemContainerStyle as Record<string, unknown>, {
      resolveValues: 'value',
    }),
    ...{ flex: itemContainerStyle.flex },
  };
  const rawItemTitleStyle = {
    ...useStyle(itemTitleStyle as Record<string, unknown>, {
      resolveValues: 'value',
    }),
    ...{ fontSize: itemTitleStyle.fontSize },
  };
  const rawItemTitleNormalStyle = {
    ...useStyle(itemTitleNormalStyle as Record<string, unknown>, {
      resolveValues: 'value',
    }),
    ...{
      color: rawNormalColor,
      fontSize: itemTitleNormalStyle.fontSize ?? itemTitleStyle.fontSize,
    },
  };
  const rawItemTitleSelectedStyle = {
    ...useStyle(itemTitleSelectedStyle as Record<string, unknown>, {
      resolveValues: 'value',
    }),
    ...{
      color: rawSelectedColor,
      fontSize: itemTitleSelectedStyle.fontSize ?? itemTitleStyle.fontSize,
    },
  };
  const rawCursorStyle = useStyle(cursorStyle as Record<string, unknown>, {
    resolveValues: 'value',
  });
  rawCursorStyle.left = reloadWebPxNumber(rawCursorStyle?.left);
  rawCursorStyle.right = reloadWebPxNumber(rawCursorStyle?.right);
  rawCursorStyle.width = reloadWebPxNumber(rawCursorStyle?.width);
  return (
    <>
      <PageHeaderView
        ref={ref}
        titleFromItem={titleFromItem}
        style={rawStyle as any}
        contentContainerStyle={rawContentContainerStyle}
        scrollContainerStyle={rawScrollContainerStyle}
        containerStyle={rawContainerStyle}
        itemContainerStyle={rawItemContainerStyle}
        itemTitleStyle={rawItemTitleStyle}
        itemTitleNormalStyle={rawItemTitleNormalStyle}
        itemTitleSelectedStyle={rawItemTitleSelectedStyle}
        cursorStyle={rawCursorStyle}
        scrollEventThrottle={16}
        onScroll={(event) => {
          scrollValue.current = event.nativeEvent;
          rawProps?.onScroll?.(event);
          const leftDisabled = scrollValue.current.contentOffset.x <= 100;
          const rightDisabled =
            scrollValue.current.contentOffset.x >=
            scrollValue.current.contentSize.width -
              scrollValue.current.layoutMeasurement.width -
              100;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          leftArrowRef?.current?.setNativeProps?.({
            disabled: leftDisabled,
            style: {
              opacity: leftDisabled ? 0 : 1,
            },
          });
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          rightArrowRef?.current?.setNativeProps?.({
            disabled: rightDisabled,
            style: {
              opacity: rightDisabled ? 0 : 1,
            },
          });
        }}
        {...rawProps}
        data={data}
      />
      {showHorizontalScrollButton ? (
        <>
          <Pressable
            ref={leftArrowRef}
            style={{
              position: 'absolute',
              zIndex: 1,
              opacity: 0,
            }}
            disabled
            onPress={() => {
              // @ts-expect-error
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
              ref?.current?.scrollView?.current?.scrollTo?.({
                x:
                  scrollValue.current.contentOffset.x -
                  scrollValue.current.layoutMeasurement.width,
              });
            }}
          >
            <Icon
              name="ArrowLeftOutline"
              size="small"
              px="$3"
              h="$10"
              bg="$bgApp"
            />
          </Pressable>
          <Pressable
            ref={rightArrowRef}
            style={{
              position: 'absolute',
              right: 0,
              zIndex: 1,
              opacity: 0,
            }}
            disabled
            onPress={() => {
              // @ts-expect-error
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
              ref?.current?.scrollView?.current?.scrollTo?.({
                x:
                  scrollValue.current.contentOffset.x +
                  scrollValue.current.layoutMeasurement.width,
              });
            }}
          >
            <Icon
              name="ArrowRightOutline"
              size="small"
              px="$3"
              h="$10"
              bg="$bgApp"
            />
          </Pressable>
        </>
      ) : null}
    </>
  );
};

export const Header = forwardRef(HeaderComponent);
