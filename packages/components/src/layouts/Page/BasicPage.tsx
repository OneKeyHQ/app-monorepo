import { useHeaderHeight } from '@react-navigation/elements';
import { useWindowDimensions } from 'react-native';

import { Stack } from '../../primitives';

import type { IBasicPageProps } from './type';

export function BasicPage({ children }: IBasicPageProps) {
  const headerHeight = useHeaderHeight();
  const windowHeight = useWindowDimensions().height;
  const height = windowHeight - headerHeight;

  console.log(height);
  return (
    <Stack bg="$bgApp" flex={1} maxHeight={height}>
      {children}
    </Stack>
  );
}
