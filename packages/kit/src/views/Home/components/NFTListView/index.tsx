import type { ComponentProps } from 'react';
import { useMemo } from 'react';

import type { ListView } from '@onekeyhq/components';
import {
  Tabs,
  useScrollContentTabBarOffset,
  useStyle,
} from '@onekeyhq/components';
import {
  useTabsContext,
  useTabsScrollContext,
} from '@onekeyhq/components/src/composite/Tabs/context';
import { useIsFocusedTab } from '@onekeyhq/components/src/composite/Tabs/hooks';
import useActiveTabDAppInfo from '@onekeyhq/kit/src/views/DAppConnection/hooks/useActiveTabDAppInfo';

import { NFTListView as SharedNFTListView } from './NativeNFTList';

import type { ViewStyle } from 'react-native';

type IProps = Omit<
  ComponentProps<typeof SharedNFTListView>,
  'webScrollHost' | 'webContentPadding' | 'webContentWidth'
> & {
  inTabList?: boolean;
  listViewStyleProps?: Pick<
    ComponentProps<typeof ListView>,
    | 'ListHeaderComponentStyle'
    | 'ListFooterComponentStyle'
    | 'contentContainerStyle'
  >;
};

export function NFTListView({ listViewStyleProps, ...props }: IProps) {
  const { scrollElement } = useTabsContext();
  const isFocusedTab = useIsFocusedTab();
  const { width } = useTabsScrollContext();
  const tabBarHeight = useScrollContentTabBarOffset();
  const { result: activeDApp } = useActiveTabDAppInfo();
  const contentStyle = useStyle(
    {
      mt: '$3',
      pb: activeDApp?.showFloatingPanel ? '$16' : (tabBarHeight ?? '$6'),
      px: '$2.5',
      ...listViewStyleProps?.contentContainerStyle,
    },
    { resolveValues: 'value' },
  ) as ViewStyle;
  const webContentPadding = useMemo(() => {
    let horizontal = 10;
    if (typeof contentStyle.paddingHorizontal === 'number')
      horizontal = contentStyle.paddingHorizontal;
    else if (typeof contentStyle.paddingLeft === 'number')
      horizontal = contentStyle.paddingLeft;
    let bottom = activeDApp?.showFloatingPanel ? 64 : (tabBarHeight ?? 24);
    if (typeof contentStyle.paddingBottom === 'number')
      bottom = contentStyle.paddingBottom;
    return {
      horizontal,
      top:
        typeof contentStyle.marginTop === 'number'
          ? contentStyle.marginTop
          : 12,
      bottom,
    };
  }, [
    contentStyle.paddingHorizontal,
    contentStyle.paddingLeft,
    contentStyle.marginTop,
    contentStyle.paddingBottom,
    activeDApp?.showFloatingPanel,
    tabBarHeight,
  ]);
  return (
    <Tabs.ScrollView>
      <SharedNFTListView
        {...props}
        webScrollHost={isFocusedTab ? (scrollElement ?? null) : null}
        webContentPadding={webContentPadding}
        webContentWidth={width}
      />
    </Tabs.ScrollView>
  );
}
