import { useLayoutEffect, useMemo, useState } from 'react';

import { useHeaderHeight } from '@react-navigation/elements';
import { useWindowDimensions } from 'react-native';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EPageType, usePageType } from '../../hocs';
import { useIsDesktopModeUIInTabPages } from '../../hooks';
import { Stack } from '../../primitives';

import type { IBasicPageProps } from './type';

const useMaxHeight = () => {
  const headerHeight = useHeaderHeight();
  const windowHeight = useWindowDimensions().height;
  return windowHeight - headerHeight;
};

const useHeightStyle = platformEnv.isNative
  ? () => {
      const { md } = useMedia();
      const maxHeight = useMaxHeight();
      if (md) {
        return {
          maxHeight,
        };
      }
      return {
        maxHeight: '100%',
      };
    }
  : () => {
      const { md } = useMedia();
      const maxHeight = useMaxHeight();
      if (md) {
        return {
          height: maxHeight,
          maxHeight: '100%',
        };
      }
      return {
        maxHeight: '100%',
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
    return isDesktopLayout
      ? {
          borderRadius: '$4' as const,
          borderWidth: 1,
          borderColor: '$borderSubdued',
          mr: '$1',
          mb: '$1',
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
