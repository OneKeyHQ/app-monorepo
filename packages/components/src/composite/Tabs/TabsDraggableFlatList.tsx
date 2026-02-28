import React from 'react';
import type { FlatList as RNFlatList } from 'react-native';

import DraggableFlatList from 'react-native-draggable-flatlist';
import type { DraggableFlatListProps } from 'react-native-draggable-flatlist';
import {
  useAfterMountEffect,
  useChainCallback,
  useCollapsibleStyle,
  useScrollHandlerY,
  useSharedAnimatedRef,
  useTabNameContext,
  useTabsContext,
  useUpdateScrollViewContentSize,
} from 'react-native-collapsible-tab-view/lib/module/hooks';

function TabsDraggableFlatListImpl<T>(
  {
    contentContainerStyle,
    style,
    onContentSizeChange,
    ...rest
  }: DraggableFlatListProps<T>,
  passRef: React.Ref<RNFlatList>,
): React.ReactElement {
  const name = useTabNameContext();
  const { setRef, contentInset } = useTabsContext();
  const ref = useSharedAnimatedRef<RNFlatList<unknown>>(passRef);

  const { scrollHandler, enable } = useScrollHandlerY(name);
  const onLayout = useAfterMountEffect(rest.onLayout, () => {
    'worklet';
    enable(true);
  });

  const {
    style: _style,
    contentContainerStyle: _contentContainerStyle,
    progressViewOffset,
  } = useCollapsibleStyle();

  React.useEffect(() => {
    setRef(name, ref);
  }, [name, ref, setRef]);

  const scrollContentSizeChange = useUpdateScrollViewContentSize({
    name,
  });

  const scrollContentSizeChangeHandlers = useChainCallback(
    React.useMemo(
      () => [scrollContentSizeChange, onContentSizeChange],
      [onContentSizeChange, scrollContentSizeChange],
    ),
  );

  const memoContentInset = React.useMemo(
    () => ({ top: contentInset }),
    [contentInset],
  );

  const memoContentOffset = React.useMemo(
    () => ({ x: 0, y: -contentInset }),
    [contentInset],
  );

  const memoContentContainerStyle = React.useMemo(
    () => [_contentContainerStyle, contentContainerStyle as any],
    [_contentContainerStyle, contentContainerStyle],
  );

  const memoStyle = React.useMemo(() => [_style, style], [_style, style]);

  return (
    <DraggableFlatList<T>
      {...rest}
      onLayout={onLayout}
      ref={ref as any}
      containerStyle={{ flex: 1 }}
      style={memoStyle as any}
      contentContainerStyle={memoContentContainerStyle as any}
      progressViewOffset={progressViewOffset}
      onScroll={scrollHandler}
      onContentSizeChange={scrollContentSizeChangeHandlers}
      scrollEventThrottle={1}
      contentInset={memoContentInset}
      contentOffset={memoContentOffset}
      automaticallyAdjustContentInsets={false}
      // workaround for: https://github.com/software-mansion/react-native-reanimated/issues/2735
      onMomentumScrollEnd={() => {}}
    />
  );
}

export const TabsDraggableFlatList = React.forwardRef(
  TabsDraggableFlatListImpl,
) as <T>(
  props: DraggableFlatListProps<T> & { ref?: React.Ref<RNFlatList<T>> }
) => React.ReactElement;
