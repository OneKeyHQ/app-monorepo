import { useCallback, useMemo, useState } from 'react';

import { Button, Stack, Text } from '@onekeyhq/components';
import {
  TabHomeParamList,
  TabHomeRoutes,
} from '../../../../routes/Root/Tab/Home/Routes';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import { PageNavigationProp } from '@onekeyhq/components/src/Navigation';

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
  }, []);

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
        <Button onPress={headerHeightCall}>
          <Button.Text>切换高度</Button.Text>
        </Button>
        <Button onPress={switchDemoVisibleCall}>
          <Button.Text>切换 Demo3 显示</Button.Text>
        </Button>
        <Button onPress={onNextPageCall}>
          <Button.Text>下一页</Button.Text>
        </Button>
      </Stack>
    ),
    [headerHighMode, headerHeightCall, onNextPageCall, switchDemoVisibleCall],
  );
}
