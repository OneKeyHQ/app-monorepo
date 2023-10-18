import { useCallback, useMemo, useState } from 'react';

import { Button, Stack, Text } from '@onekeyhq/components';
import type { PageNavigationProp } from '@onekeyhq/components/src/Navigation';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { TabHomeRoutes } from '../../../../routes/Root/Tab/Home/Routes';

import type { TabHomeParamList } from '../../../../routes/Root/Tab/Home/Routes';

export default function HomePageHeaderView({
  switchDemoVisible,
}: {
  switchDemoVisible: () => void;
}) {
  const navigation = useAppNavigation<PageNavigationProp<TabHomeParamList>>();
  const [headerHighMode, setHeaderHighMode] = useState(true);

  const headerHeightCall = useCallback(() => {
    setHeaderHighMode((pre) => !pre);
  }, []);

  const switchDemoVisibleCall = useCallback(() => {
    switchDemoVisible?.();
  }, [switchDemoVisible]);

  const onNextPageCall = useCallback(() => {
    navigation.push(TabHomeRoutes.TabHomeStack1);
  }, [navigation]);

  return useMemo(
    () => (
      <Stack
        backgroundColor="$bg"
        alignItems="center"
        justifyContent="center"
        py="$4"
      >
        <Text>Header View Simple</Text>
        <Text>{`Header Height ${headerHighMode.toString()}`}</Text>
        {headerHighMode && <Text py="$10">Very high</Text>}
        <Button onPress={headerHeightCall}>切换高度</Button>
        <Button onPress={switchDemoVisibleCall}>切换 Demo3 显示</Button>
        <Button onPress={onNextPageCall}>下一页</Button>
      </Stack>
    ),
    [headerHighMode, headerHeightCall, onNextPageCall, switchDemoVisibleCall],
  );
}
