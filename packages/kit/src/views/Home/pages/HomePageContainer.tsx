import { useState } from 'react';

import DAppConnectExtensionFloatingTrigger from '@onekeyhq/kit/src/views/DAppConnection/components/DAppConnectExtensionFloatingTrigger';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debugUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import {
  useActiveAccount,
  useSelectedAccount,
} from '../../../states/jotai/contexts/accountSelector';
import { OnboardingOnMount } from '../../Onboarding/components';

import { HomePageView } from './HomePageView';

function ActiveAccountTest() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  console.log('AccountSelectorAtomChanged activeAccount: ', activeAccount);
  return null;
}

function SelectedAccountTest() {
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  console.log('AccountSelectorAtomChanged selectedAccount: ', selectedAccount);
  return null;
}

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
      <ActiveAccountTest />
      <SelectedAccountTest />
      {/* <UrlAccountAutoReplaceHistory num={0} /> */}
    </AccountSelectorProviderMirror>
  );
}

export default HomePageContainer;
