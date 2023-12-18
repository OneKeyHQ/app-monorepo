import { useHeaderHeight } from '@react-navigation/elements';
import { useWindowDimensions } from 'react-native';
import { useMedia } from 'tamagui';

import { Stack } from '../../primitives';

import type { IBasicPageProps } from './type';

const usePageHeight = () => {
  const { md } = useMedia();
  const headerHeight = useHeaderHeight();
  const windowHeight = useWindowDimensions().height;
  if (md) {
    return windowHeight - headerHeight;
  }
  return '100%';
};

export function BasicPage({ children }: IBasicPageProps) {
  // fix scrolling issues on md Web
  const height = usePageHeight();
  return (
    <Stack bg="$bgApp" flex={1} maxHeight={height}>
      {children}
    </Stack>
  );
}
