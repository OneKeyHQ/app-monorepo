import { useCallback, useMemo, useState } from 'react';

import { Button, SizableText, YStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorActiveAccount,
  AccountSelectorProviderMirror,
  AccountSelectorTrigger,
} from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import { EOnboardingPages } from '../../Onboarding/router/type';
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
    navigation.pushFullModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.GetStarted,
    });
  }, [navigation]);

  const navigateOnboardingModal = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.GetStarted,
    });
  }, [navigation]);

  return useMemo(
    () => (
      <YStack alignItems="center" justifyContent="center" py="$4" space="$3">
        <AccountSelectorProviderMirror
          config={{
            sceneName: EAccountSelectorSceneName.home,
            sceneUrl: '',
          }}
          enabledNum={[0]}
        >
          <AccountSelectorTrigger num={0} />
          <AccountSelectorActiveAccount num={0} />
        </AccountSelectorProviderMirror>
        <SizableText>Header View Simple</SizableText>
        <SizableText>{`Header Height ${headerHighMode.toString()}`}</SizableText>
        {headerHighMode && <SizableText py="$10">Very high</SizableText>}
        <Button onPress={headerHeightCall}>切换高度</Button>
        {/* <Button onPress={switchDemoVisibleCall}>切换 Demo3 显示</Button> */}
        <Button onPress={onNextPageCall}>下一页</Button>
        <Button onPress={navigateTestSimpleModal}>to TestSimpleModal</Button>
        <Button onPress={navigateOnboardingModal}>Onboarding</Button>
        <Button onPress={navigateFullScreenSimpleModal}>
          to fullScreen Onboarding
        </Button>
      </YStack>
    ),
    [
      headerHighMode,
      headerHeightCall,
      onNextPageCall,
      navigateTestSimpleModal,
      navigateFullScreenSimpleModal,
      navigateOnboardingModal,
    ],
  );
}
