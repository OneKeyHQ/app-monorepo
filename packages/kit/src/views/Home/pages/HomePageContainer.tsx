import { useState } from 'react';

import type { ITourStep } from '@onekeyhq/components';
import { SpotlightTour, TourBox } from '@onekeyhq/components';
import DAppConnectExtensionFloatingTrigger from '@onekeyhq/kit/src/views/DAppConnection/components/DAppConnectExtensionFloatingTrigger';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debugUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { withAccountOverviewProvider } from '../../../states/jotai/contexts/accountOverview';
import {
  useActiveAccount,
  useSelectedAccount,
  useSelectedAccountsAtom,
} from '../../../states/jotai/contexts/accountSelector';
import { OnboardingOnMount } from '../../Onboarding/components';

import { HomePageView } from './HomePageView';

function EmptyRenderTest() {
  console.log('AccountSelectorAtomChanged EmptyRenderTest render');
  return null;
}

function ActiveAccountTest() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  console.log('AccountSelectorAtomChanged activeAccount: ', activeAccount);
  return null;
}

function SelectedAccountTest() {
  const { selectedAccount } = useSelectedAccount({
    num: 0,
    debugName: 'HomePage',
  });
  console.log('AccountSelectorAtomChanged selectedAccount: ', selectedAccount);
  return null;
}

function SelectedAccountsMapTest() {
  const [selectedAccounts] = useSelectedAccountsAtom();
  console.log(
    'AccountSelectorAtomChanged selectedAccountsMap: ',
    selectedAccounts,
  );
  return null;
}

const steps: ITourStep[] = [
  {
    render: (props) => (
      <TourBox
        title="Tour: Customization"
        backText="Previous"
        nextText="Next"
        {...props}
      />
    ),
  },
];

function HomePageContainer() {
  const [isHide, setIsHide] = useState(false);
  console.log('AccountSelectorAtomChanged HomePageContainer render');

  useDebugComponentRemountLog({ name: 'HomePageContainer' });

  if (isHide) {
    return null;
  }
  const sceneName = EAccountSelectorSceneName.home;
  return (
    <SpotlightTour steps={steps}>
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

        {process.env.NODE_ENV !== 'production' ? (
          <>
            <SelectedAccountsMapTest />
            <SelectedAccountTest />
            <ActiveAccountTest />
            <EmptyRenderTest />
          </>
        ) : null}
      </AccountSelectorProviderMirror>
    </SpotlightTour>
  );
}

export default withAccountOverviewProvider(HomePageContainer);
