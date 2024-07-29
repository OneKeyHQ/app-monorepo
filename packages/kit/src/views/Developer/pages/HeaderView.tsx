import { useCallback, useMemo, useState } from 'react';

import { Button, SizableText, YStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import { useToOnBoardingPage } from '@onekeyhq/kit/src/views/Onboarding/pages';
import type { ITabDeveloperParamList } from '@onekeyhq/shared/src/routes';
import {
  EModalRoutes,
  ETabDeveloperRoutes,
  ETestModalPages,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerLegacy,
} from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';

function HomeAccountSelectorInfoDemo() {
  return (
    <YStack mx="$2" my="$4">
      <AccountSelectorTriggerLegacy num={0} />
      <Button
        onPress={() => {
          // void backgroundApiProxy.serviceHardware.showEnterPinOnDeviceDialog();
        }}
      >
        硬件输入 PIN
      </Button>
      <Button
        onPress={() => {
          void backgroundApiProxy.serviceHardwareUI.showEnterPassphraseOnDeviceDialog();
        }}
      >
        硬件输入 Passphrase
      </Button>
    </YStack>
  );
}

export default function DemoHomePageHeaderView() {
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

  const toOnBoardingPage = useToOnBoardingPage();

  const navigateTestSimpleModal = useCallback(() => {
    navigation.pushModal(EModalRoutes.TestModal, {
      screen: ETestModalPages.TestSimpleModal,
    });
  }, [navigation]);

  const navigateFullScreenSimpleModal = useCallback(() => {
    void toOnBoardingPage({ isFullModal: true });
  }, [toOnBoardingPage]);

  const navigateOnboardingModal = useCallback(() => {
    void toOnBoardingPage();
  }, [toOnBoardingPage]);

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
          <HomeAccountSelectorInfoDemo />
        </AccountSelectorProviderMirror>
        <SizableText>DEMO Header View Simple</SizableText>
        <SizableText>{`Header Height ${headerHighMode.toString()}`}</SizableText>
        {headerHighMode ? <SizableText py="$10">Very high</SizableText> : null}
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
