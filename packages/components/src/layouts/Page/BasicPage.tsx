import { useLayoutEffect, useState } from 'react';

import { useHeaderHeight } from '@react-navigation/elements';
import { useWindowDimensions } from 'react-native';
import { useMedia } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

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

  // fix re-execute issues in Lazy Component via render phrase
  const [isLayoutMount, setIsLayoutMount] = useState(false);
  useLayoutEffect(() => {
    setIsLayoutMount(true);
  }, []);
  return isLayoutMount ? (
    <Stack bg="$bgApp" flex={1} {...heightStyle}>
      {children}
    </Stack>
  ) : null;
}
