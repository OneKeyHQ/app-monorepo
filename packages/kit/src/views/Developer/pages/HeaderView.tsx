import { useCallback, useMemo, useState } from 'react';

import { Button, Text, YStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EIOSFullScreenModalRoutes } from '../../../routes/iOSFullScreen/type';
import { EModalRoutes } from '../../../routes/Modal/type';
import { EIOSFullScreenTestModalPages } from '../../iOSFullScreenTestModal/router/type';
import { ETestModalPages } from '../../TestModal/router/type';
import { ETabDeveloperRoutes } from '../type';

import type { ITabDeveloperParamList } from '../type';

export default function HomePageHeaderView() {
  const navigation =
    useAppNavigation<IPageNavigationProp<ITabDeveloperParamList>>();
  const [headerHighMode, setHeaderHighMode] = useState(true);

  const headerHeightCall = useCallback(() => {
    setHeaderHighMode((pre) => !pre);
  }, []);

  const onNextPageCall = useCallback(() => {
    navigation.push(ETabDeveloperRoutes.DevHomeStack1, {
      a: '1',
      b: '2',
    });
  }, [navigation]);

  const navigateTestSimpleModal = useCallback(() => {
    navigation.pushModal(EModalRoutes.TestModal, {
      screen: ETestModalPages.TestSimpleModal,
    });
  }, [navigation]);

  const navigateFullScreenSimpleModal = useCallback(() => {
    navigation.pushFullModal(EIOSFullScreenModalRoutes.iOSFullScreenTestModal, {
      screen: EIOSFullScreenTestModalPages.TestFullSimpleModal,
    });
  }, [navigation]);

  return useMemo(
    () => (
      <YStack alignItems="center" justifyContent="center" py="$4" space="$3">
        <Text>Header View Simple</Text>
        <Text>{`Header Height ${headerHighMode.toString()}`}</Text>
        {headerHighMode && <Text py="$10">Very high</Text>}
        <Button onPress={headerHeightCall}>切换高度</Button>
        {/* <Button onPress={switchDemoVisibleCall}>切换 Demo3 显示</Button> */}
        <Button onPress={onNextPageCall}>下一页</Button>
        <Button onPress={navigateTestSimpleModal}>to TestSimpleModal</Button>
        <Button onPress={navigateFullScreenSimpleModal}>
          to TestFullScreenSimpleModal
        </Button>
      </YStack>
    ),
    [
      headerHighMode,
      headerHeightCall,
      onNextPageCall,
      navigateTestSimpleModal,
      navigateFullScreenSimpleModal,
    ],
  );
}
