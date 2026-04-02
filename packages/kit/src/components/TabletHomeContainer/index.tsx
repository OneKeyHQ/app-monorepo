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
  ESplitViewType,
  Icon,
  YStack,
  isNativeTablet,
  useIsSplitView,
  useSplitViewType,
} from '@onekeyhq/components';

import type { LayoutChangeEvent } from 'react-native';

export function TabletHomeContainer({ children }: PropsWithChildren) {
  const splitViewType = useSplitViewType();
  const isLandscape = useIsSplitView();

  if (splitViewType === ESplitViewType.MAIN && !isLandscape) {
    return null;
  }

  if (splitViewType === ESplitViewType.SUB && isLandscape) {
    return (
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        bg="$bgSubdued"
      >
        <Icon
          name="OnekeyLogoMonoIllus"
          width={80}
          height={80}
          color="$neutral4"
          mb="$16"
        />
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
  const isTablet = isNativeTablet();
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
