import { useLayoutEffect, useMemo, useState } from 'react';

import { useHeaderHeight } from '@react-navigation/elements';
import { useWindowDimensions } from 'react-native';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useIsDesktopModeUIInTabPages } from '../../hooks';
import { Stack } from '../../primitives';
import {
  DESKTOP_MODE_UI_HEADER_HEIGHT,
  DESKTOP_MODE_UI_PAGE_BORDER_COLOR,
  DESKTOP_MODE_UI_PAGE_BORDER_WIDTH,
  DESKTOP_MODE_UI_PAGE_MARGIN,
} from '../../utils';

import type { IBasicPageProps } from './type';

const useMaxHeight = () => {
  const headerHeight = useHeaderHeight();
  const windowHeight = useWindowDimensions().height;
  return windowHeight - headerHeight;
};

const useHeightStyle = () => {
  const { md } = useMedia();
  const maxHeight = useMaxHeight();
  if (md) {
    return {
      height: maxHeight,
      maxHeight: '100%',
    };
  }
  return {
    height: `calc(100vh - ${
      DESKTOP_MODE_UI_PAGE_MARGIN + DESKTOP_MODE_UI_HEADER_HEIGHT
    }px)`,
  };
};

export function BasicPage({
  children,
  testID,
  backgroundColor,
}: IBasicPageProps) {
  // fix scrolling issues on md Web
  const heightStyle = useHeightStyle();

  const isDesktopLayout = useIsDesktopModeUIInTabPages();
  // fix re-execute issues in Lazy Component via render phrase
  const [isLayoutMount, setIsLayoutMount] = useState(false);
  useLayoutEffect(() => {
    setIsLayoutMount(true);
  }, []);
  const desktopProps = useMemo(() => {
    return isDesktopLayout && !platformEnv.isWebDappMode
      ? {
          borderTopLeftRadius: '$4' as const,
          borderTopRightRadius: '$4' as const,
          // The page meets the window's right and bottom edges, so the line
          // runs along the top and left only. The right border stays for the
          // top-right corner, whose line would otherwise thin out to nothing;
          // the negative margin moves its straight part just past the window.
          borderTopWidth: DESKTOP_MODE_UI_PAGE_BORDER_WIDTH,
          borderLeftWidth: DESKTOP_MODE_UI_PAGE_BORDER_WIDTH,
          borderRightWidth: DESKTOP_MODE_UI_PAGE_BORDER_WIDTH,
          borderBottomWidth: 0,
          borderColor: DESKTOP_MODE_UI_PAGE_BORDER_COLOR,
          mr: DESKTOP_MODE_UI_PAGE_MARGIN - DESKTOP_MODE_UI_PAGE_BORDER_WIDTH,
          mb: DESKTOP_MODE_UI_PAGE_MARGIN,
          overflow: 'hidden' as const,
        }
      : undefined;
  }, [isDesktopLayout]);
  return isLayoutMount ? (
    <Stack
      backgroundColor={backgroundColor ?? '$bgApp'}
      flex={1}
      testID={testID}
      {...heightStyle}
      {...desktopProps}
    >
      {children}
    </Stack>
  ) : null;
}
