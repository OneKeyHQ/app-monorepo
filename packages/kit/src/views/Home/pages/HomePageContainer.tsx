import { useEffect, useState } from 'react';

import DAppConnectExtensionFloatingTrigger from '@onekeyhq/kit/src/views/DAppConnection/components/DAppConnectExtensionFloatingTrigger';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TabletHomeContainer } from '../../../components/TabletHomeContainer';
import { withAccountOverviewProvider } from '../../../states/jotai/contexts/accountOverview';
import {
  useActiveAccount,
  useSelectedAccount,
  useSelectedAccountsAtom,
} from '../../../states/jotai/contexts/accountSelector';
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

  // Idle prefetch common modal bundles (send/receive/address book/scan) after home mounts.
  useEffect(() => {
    const idle =
      (!platformEnv.isNative &&
        typeof globalThis !== 'undefined' &&
        globalThis.requestIdleCallback) ||
      ((cb: () => void) => setTimeout(cb, 200));
    const cancelIdle =
      (!platformEnv.isNative &&
        typeof globalThis !== 'undefined' &&
        globalThis.cancelIdleCallback) ||
      ((id: ReturnType<typeof setTimeout>) => clearTimeout(id));
    const idleId = idle(() => {
      void Promise.all([
        import(
          /* webpackPrefetch: true */ '@onekeyhq/kit/src/views/Send/pages/SendDataInput/SendDataInputContainer'
        ),
        import(
          /* webpackPrefetch: true */ '@onekeyhq/kit/src/views/Send/pages/SendConfirm/SendConfirmContainer'
        ),
        import(
          /* webpackPrefetch: true */ '@onekeyhq/kit/src/views/Receive/pages/ReceiveToken'
        ),
        import(
          /* webpackPrefetch: true */ '@onekeyhq/kit/src/views/AddressBook/pages/ListItem'
        ),
        import(
          /* webpackPrefetch: true */ '@onekeyhq/kit/src/views/ScanQrCode/pages/ScanQrCodeModal'
        ),
      ]);
    });
    return () => cancelIdle(idleId);
  }, []);

  useDebugComponentRemountLog({ name: 'HomePageContainer' });

  if (isHide) {
    return null;
  }
  const sceneName = EAccountSelectorSceneName.home;
  return (
    <TabletHomeContainer>
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
    </TabletHomeContainer>
  );
}

export default withAccountOverviewProvider(HomePageContainer);
