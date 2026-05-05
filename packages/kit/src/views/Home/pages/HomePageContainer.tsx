import { useMemo, useState } from 'react';

import { Stack, useIsDesktopModeUIInTabPages } from '@onekeyhq/components';
import DAppConnectExtensionFloatingTrigger from '@onekeyhq/kit/src/views/DAppConnection/components/DAppConnectExtensionFloatingTrigger';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TabletHomeContainer } from '../../../components/TabletHomeContainer';
import { ProviderJotaiContextAccountOverview } from '../../../states/jotai/contexts/accountOverview';
import {
  useActiveAccount,
  useSelectedAccount,
  useSelectedAccountsAtom,
} from '../../../states/jotai/contexts/accountSelector';
import { useJotaiContextRootStore } from '../../../states/jotai/utils/useJotaiContextRootStore';
import { NotificationRegisterDaily } from '../../Notifications/components/NotificationRegisterDaily';
import { OnboardingOnMount } from '../../Onboarding/components';
import { BTCFreshAddressProvider } from '../components/BTCFreshAddressProvider';

import { HomePageView } from './HomePageView';

function EmptyRenderTest() {
  // console.log('AccountSelectorAtomChanged EmptyRenderTest render');
  return null;
}

function ActiveAccountTest() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { activeAccount } = useActiveAccount({ num: 0 });
  // console.log('AccountSelectorAtomChanged activeAccount: ', activeAccount);
  return null;
}

function SelectedAccountTest() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { selectedAccount } = useSelectedAccount({
    num: 0,
    debugName: 'HomePage',
  });
  // console.log('AccountSelectorAtomChanged selectedAccount: ', selectedAccount);
  return null;
}

function SelectedAccountsMapTest() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedAccounts] = useSelectedAccountsAtom();
  // console.log(
  //   'AccountSelectorAtomChanged selectedAccountsMap: ',
  //   selectedAccounts,
  // );
  return null;
}

function HomePageContainer() {
  const [isHide, setIsHide] = useState(false);
  const isDesktopModeUI = useIsDesktopModeUIInTabPages();

  useDebugComponentRemountLog({ name: 'HomePageContainer' });

  if (isHide) {
    return null;
  }
  const sceneName = EAccountSelectorSceneName.home;
  return (
    <TabletHomeContainer>
      <Stack
        flex={1}
        className="HomeRootTabPageContainer"
        bg={isDesktopModeUI ? '$bgSubdued' : '$bgApp'}
      >
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
          <NotificationRegisterDaily />
          <BTCFreshAddressProvider />
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
      </Stack>
    </TabletHomeContainer>
  );
}

function useHomeAccountOverviewContextStoreInitData() {
  const data = useMemo(
    () => ({
      storeName: EJotaiContextStoreNames.homeAccountOverview,
    }),
    [],
  );
  return data;
}

function HomePageContainerWithOverviewProvider() {
  const data = useHomeAccountOverviewContextStoreInitData();
  const store = useJotaiContextRootStore(data);
  return (
    <ProviderJotaiContextAccountOverview store={store}>
      <HomePageContainer />
    </ProviderJotaiContextAccountOverview>
  );
}

export default HomePageContainerWithOverviewProvider;
