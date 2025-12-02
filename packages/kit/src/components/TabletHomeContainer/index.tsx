import {
  Fragment,
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import {
  Image,
  SizableText,
  YStack,
  useIsTablet,
  useIsTabletDetailView,
  useOrientation,
} from '@onekeyhq/components';

import type { LayoutChangeEvent } from 'react-native';

export function TabletHomeContainer({ children }: PropsWithChildren) {
  const isDetailView = useIsTabletDetailView();
  const isLandscape = useOrientation();

  if (isDetailView && isLandscape) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" gap="$4">
        <Image source={require('@onekeyhq/kit/assets/logo.png')} size={124} />
        <SizableText size="$heading5xl">OneKey</SizableText>
      </YStack>
    );
  }

  return children;
}

export const TabletModalContainerContext = createContext<{
  width: number;
}>({
  width: 0,
});

export const useTabletModalPageWidth = () => {
  const { width } = useContext(TabletModalContainerContext);
  return width || undefined;
};

export function TabletModalContainer({ children }: PropsWithChildren) {
  const isTablet = useIsTablet();
  const [width, setWidth] = useState(0);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setWidth(event.nativeEvent.layout.width);
    },
    [setWidth],
  );
  const value = useMemo(
    () => ({
      width,
    }),
    [width],
  );
  if (isTablet) {
    return (
      <YStack flex={1} onLayout={onLayout}>
        {width ? (
          <TabletModalContainerContext.Provider value={value}>
            <Fragment key={width}>{children}</Fragment>
          </TabletModalContainerContext.Provider>
        ) : null}
      </YStack>
    );
  }
  return children;
}
