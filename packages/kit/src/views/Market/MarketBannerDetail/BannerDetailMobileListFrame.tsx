import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';

import { StyleSheet } from 'react-native';

import { Stack, YStack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { LayoutChangeEvent } from 'react-native';

// Must match RNSScrollEdgeElementContainerTopNativeID in the
// react-native-screens patch.
const SCROLL_EDGE_ELEMENT_CONTAINER_TOP_NATIVE_ID =
  'rnscreens-scroll-edge-element-top';

// Prototype: assumes the native shell carries the react-native-screens patch
// that attaches UIScrollEdgeElementContainerInteraction. A shipping version
// needs a native capability check so an older shell keeps the plain layout.
export const isScrollEdgeElementContainerSupported =
  platformEnv.isNativeIOS26Plus;

// Screens that pin rows under the bar opt into the patched lookup by
// configuring scrollEdgeEffects. The hard edge keeps the pinned glass region
// visually contained, matching the less transparent native page headers.
export const SCROLL_EDGE_EFFECTS_WITH_ELEMENT_CONTAINER = {
  top: 'hard',
  bottom: 'automatic',
  left: 'automatic',
  right: 'automatic',
} as const;

export type IBannerDetailHeaderOverlay = {
  // Height of the translucent native header the list scrolls beneath.
  topInset: number;
  // Pinned above the column header, e.g. a mixed banner's spot / perps tabs.
  prefix?: ReactNode;
};

// iOS 26: the list fills the page from the top edge and scrolls beneath both
// the navigation bar and the pinned rows (tabs, column header). The pinned rows
// have no background of their own; the native patch makes them part of the
// bar's scroll edge effect, so the bar and the pinned rows blur the content as
// one continuous glass region. Without an overlay the column header sits above
// the list as before.
export function BannerDetailMobileListFrame({
  overlay,
  columnHeader,
  renderList,
}: {
  overlay?: IBannerDetailHeaderOverlay;
  columnHeader: ReactNode;
  renderList: (contentTopInset: number) => ReactNode;
}) {
  const [pinnedHeight, setPinnedHeight] = useState<number>();
  const handlePinnedLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setPinnedHeight((prev) => (prev === height ? prev : height));
  }, []);

  if (!overlay) {
    return (
      <Stack flex={1}>
        {columnHeader}
        {renderList(0)}
      </Stack>
    );
  }

  return (
    <Stack flex={1}>
      {/* Hidden until the pinned rows are measured so the first rows never
          start underneath them. collapsable keeps the list's parent view
          stable when the opacity flips. */}
      <Stack
        flex={1}
        opacity={pinnedHeight === undefined ? 0 : 1}
        collapsable={false}
      >
        {renderList(pinnedHeight ?? overlay.topInset)}
      </Stack>
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        pt={overlay.topInset}
        pointerEvents="box-none"
        onLayout={handlePinnedLayout}
      >
        <YStack
          nativeID={SCROLL_EDGE_ELEMENT_CONTAINER_TOP_NATIVE_ID}
          gap="$4"
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderBottomColor="$borderSubdued"
        >
          {overlay.prefix}
          {columnHeader}
        </YStack>
      </YStack>
    </Stack>
  );
}
