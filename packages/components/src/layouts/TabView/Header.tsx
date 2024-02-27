import { forwardRef, useCallback, useMemo } from 'react';
import type { ForwardedRef } from 'react';

import { PageHeaderView } from '@onekeyfe/react-native-tab-page-view';
import { useProps, useStyle } from '@tamagui/core';
import { StyleSheet } from 'react-native';

import { useThemeValue } from '../../hooks';

import type { StackStyleProps, TextStyleProps } from '@tamagui/web/types/types';
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
  };

const HeaderComponent = (
  {
    style,
    titleFromItem = (item: { title: string }) => item.title,
    contentContainerStyle = {},
    scrollContainerStyle = {},
    containerStyle = {},
    itemContainerStyle = { px: '$2.5', pb: 2, ml: '$2.5' },
    itemTitleStyle = { fontSize: 16, fontWeight: '500' },
    itemTitleNormalStyle = { color: '$textSubdued' },
    itemTitleSelectedStyle = { color: '$text' },
    cursorStyle = {
      left: '$2.5',
      right: '$2.5',
      h: '$0.5',
      bg: '$bgPrimary',
    },
    ...props
  }: IHeaderProps,
  ref: ForwardedRef<PageHeaderView>,
) => {
  const normalColor = itemTitleNormalStyle.color;
  const selectedColor = itemTitleSelectedStyle.color;
  const [rawNormalColor, rawSelectedColor] = useThemeValue(
    // @ts-expect-error
    [normalColor, selectedColor],
    undefined,
    true,
  );
  const data = useMemo(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    () => [...props.data],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.data, rawNormalColor, rawSelectedColor],
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
  const rawStyle = useStyle(
    {
      ...{
        h: '$11',
        bg: '$bgApp',
        borderBottomColor: '$borderSubdued',
        borderBottomWidth: StyleSheet.hairlineWidth,
      },
      ...style,
    } as Record<string, unknown>,
    {
      resolveValues: 'value',
    },
  );
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
      {...rawProps}
      data={data}
    />
  );
};

export const Header = forwardRef(HeaderComponent);
