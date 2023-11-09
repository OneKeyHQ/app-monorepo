import { useCallback, useMemo, useState } from 'react';

import { Button, Stack, Text } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';
import { GalleryRoutes } from '@onekeyhq/kit/src/routes/Gallery/routes';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { RootRoutes } from '../../../../routes/Root/Routes';
import { EGalleryRoutes } from '../../../../routes/Root/Tab/Developer/Gallery/routes';
import { TabHomeRoutes } from '../../../../routes/Root/Tab/Home/Routes';

import type { TabHomeParamList } from '../../../../routes/Root/Tab/Home/Routes';

// export default function HomePageHeaderView({
//   switchDemoVisible,
// }: {
//   switchDemoVisible: () => void;
// }) {
export default function HomePageHeaderView() {
  const navigation = useAppNavigation<IPageNavigationProp<TabHomeParamList>>();
  const [headerHighMode, setHeaderHighMode] = useState(true);

  const headerHeightCall = useCallback(() => {
    setHeaderHighMode((pre) => !pre);
  }, []);

  // const switchDemoVisibleCall = useCallback(() => {
  //   switchDemoVisible?.();
  // }, [switchDemoVisible]);

  const onNextPageCall = useCallback(() => {
    navigation.push(TabHomeRoutes.TabHomeStack1);
  }, [navigation]);

  return useMemo(
    () => (
      <Stack alignItems="center" justifyContent="center" py="$4">
        <Text>Header View Simple</Text>
        <Text>{`Header Height ${headerHighMode.toString()}`}</Text>
        {headerHighMode && <Text py="$10">Very high</Text>}
        <Button onPress={headerHeightCall}>切换高度</Button>
        {/* <Button onPress={switchDemoVisibleCall}>切换 Demo3 显示</Button> */}
        <Button onPress={onNextPageCall}>下一页</Button>
      </Stack>
    ),
    [
      headerHighMode,
      headerHeightCall,
      onNextPageCall,
      // switchDemoVisibleCall,
    ],
  );
}
