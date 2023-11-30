import { useCallback, useMemo, useState } from 'react';

import { Button, Text, YStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../../routes/Root/Modal/Routes';
import { EModalTestRoutes } from '../../../../routes/Root/Modal/TestModal/Routes';
import { ENativeFullScreenModalRoutes } from '../../../../routes/Root/NativeFullScreenNavigator/Routes';
import { ENativeFullModalTestRoutes } from '../../../../routes/Root/NativeFullScreenNavigator/TestModal/Routes';
import { ETabHomeRoutes } from '../../../../routes/Root/Tab/Home/Routes';

import type { ITabHomeParamList } from '../../../../routes/Root/Tab/Home/Routes';

export default function HomePageHeaderView() {
  const navigation = useAppNavigation<IPageNavigationProp<ITabHomeParamList>>();
  const [headerHighMode, setHeaderHighMode] = useState(true);

  const headerHeightCall = useCallback(() => {
    setHeaderHighMode((pre) => !pre);
  }, []);

  const onNextPageCall = useCallback(() => {
    navigation.push(ETabHomeRoutes.TabHomeStack1);
  }, [navigation]);

  const navigateTestSimpleModal = useCallback(() => {
    navigation.pushModal(EModalRoutes.TestModal, {
      screen: EModalTestRoutes.TestSimpleModal,
    });
  }, [navigation]);

  const navigateFullScreenSimpleModal = useCallback(() => {
    navigation.pushFullModal(ENativeFullScreenModalRoutes.NativeFullModal, {
      screen: ENativeFullModalTestRoutes.TestFullSimpleModal,
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
