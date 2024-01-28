import { useMemo } from 'react';

import { Spinner } from '@onekeyhq/components';
import { HeaderButtonGroup } from '@onekeyhq/components/src/layouts/Navigation/Header';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerBrowserSingle,
  NetworkSelectorTriggerBrowserSingle,
} from '@onekeyhq/kit/src/components/AccountSelector';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useActiveTabId, useWebTabDataById } from '../../hooks/useWebTabs';
import { withBrowserProvider } from '../../pages/Browser/WithBrowserProvider';

function HeaderRightToolBar() {
  const { activeTabId } = useActiveTabId();
  const { tab } = useWebTabDataById(activeTabId ?? '');
  const origin = tab?.url ? new URL(tab.url).origin : null;
  const { result: connectedAccountsInfo, isLoading } =
    usePromiseResult(async () => {
      if (!origin) {
        return;
      }
      const connectedAccount =
        await backgroundApiProxy.serviceDApp.getAllConnectedAccountsByOrigin(
          origin,
        );
      console.log('====>>>connectedAccount: ', connectedAccount);
      return connectedAccount;
    }, [origin]);

  const content = useMemo(() => {
    console.log('=====> DesktopBrowserHeaderRightCmp: memo renderer');
    if (isLoading) {
      return <Spinner />;
    }
    if (!connectedAccountsInfo || !origin) {
      return null;
    }
    return (
      <>
        {connectedAccountsInfo.map((accountInfo) => (
          <AccountSelectorProviderMirror
            config={{
              sceneName: EAccountSelectorSceneName.discover,
              sceneUrl: origin ?? '',
            }}
            enabledNum={[accountInfo.num]}
          >
            <HeaderButtonGroup>
              <AccountSelectorTriggerBrowserSingle num={accountInfo.num} />
              <NetworkSelectorTriggerBrowserSingle num={accountInfo.num} />
            </HeaderButtonGroup>
          </AccountSelectorProviderMirror>
        ))}
      </>
    );
  }, [connectedAccountsInfo, origin, isLoading]);

  return <>{content}</>;
}

export default withBrowserProvider(HeaderRightToolBar);
