import { useLayoutEffect, useMemo, useState } from 'react';

import { useHeaderHeight } from '@react-navigation/elements';
import { useWindowDimensions } from 'react-native';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useIsDesktopModeUIInTabPages } from '../../hooks';
import { Stack } from '../../primitives';
import {
  DESKTOP_MODE_UI_HEADER_HEIGHT,
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

export function BasicPage({ children }: IBasicPageProps) {
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
          borderWidth: DESKTOP_MODE_UI_PAGE_BORDER_WIDTH,
          mr: DESKTOP_MODE_UI_PAGE_MARGIN,
          mb: DESKTOP_MODE_UI_PAGE_MARGIN,
          borderColor: '$neutral3',
          overflow: 'hidden' as const,
        }
      : undefined;
  }, [isDesktopLayout]);
  return isLayoutMount ? (
    <Stack bg="$bgApp" flex={1} {...heightStyle} {...desktopProps}>
      {children}
    </Stack>
  ) : null;
}
