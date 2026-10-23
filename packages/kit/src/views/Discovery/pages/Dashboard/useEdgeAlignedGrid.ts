import { useCallback, useState } from 'react';

import { useMedia } from '@onekeyhq/components';

import { DISCOVERY_ITEM_ICON_SIZE as ICON_SIZE } from '../../components/DiscoveryItemCard';

import type { LayoutChangeEvent } from 'react-native';

const PHONE_COLUMNS = 4;

// On phones the 4-column dApp grids center each icon in its column, so the
// first and last icons sit ~16pt inside the page padding while the section
// titles start right at it. Widen the grid by a negative margin so the outer
// icons line up with the titles; labels stay centered under their icons.
export function useEdgeAlignedGrid() {
  const media = useMedia();
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);
  // Column c = (W + 2m) / 4 and icon inset (c - icon) / 2 = m solve to
  // m = (W - 4 * icon) / 6.
  const marginHorizontal =
    media.sm && width
      ? -Math.max(0, (width - PHONE_COLUMNS * ICON_SIZE) / 6)
      : 0;
  return { onLayout, marginHorizontal };
}
