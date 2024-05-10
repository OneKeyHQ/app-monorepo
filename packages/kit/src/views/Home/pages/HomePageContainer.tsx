import { useState } from 'react';

import DAppConnectExtensionFloatingTrigger from '@onekeyhq/kit/src/views/DAppConnection/components/DAppConnectExtensionFloatingTrigger';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debugUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { OnboardingOnMount } from '../../Onboarding/components';

import { HomePageView } from './HomePageView';

function HomePageContainer() {
  const [isHide, setIsHide] = useState(false);
  console.log('HomePageContainer render');

  useDebugComponentRemountLog({ name: 'HomePageContainer' });

  if (isHide) {
    return null;
  }
  const sceneName = EAccountSelectorSceneName.home;
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <HomePageView
        key={sceneName}
        sceneName={sceneName}
        onPressHide={() => setIsHide((v) => !v)}
      />
      <DAppConnectExtensionFloatingTrigger />
      <OnboardingOnMount />
      {/* <UrlAccountAutoReplaceHistory num={0} /> */}
    </AccountSelectorProviderMirror>
  );
}

export default HomePageContainer;
