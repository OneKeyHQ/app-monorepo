import { useMemo } from 'react';

import { isNil } from 'lodash';

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
  const { result: accountSelectorNum, isLoading } =
    usePromiseResult(async () => {
      if (!origin) {
        return;
      }
      const number = await backgroundApiProxy.serviceDApp.getAccountSelectorNum(
        {
          origin,
          scope: 'ethereum',
        },
      );
      return number;
    }, [origin]);

  const content = useMemo(() => {
    console.log('=====> DesktopBrowserHeaderRightCmp: memo renderer');
    if (isLoading || typeof accountSelectorNum !== 'number') {
      return <Spinner />;
    }
    return (
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.discover,
          sceneUrl: origin ?? '',
        }}
        enabledNum={[accountSelectorNum ?? 0]}
      >
        <HeaderButtonGroup>
          <AccountSelectorTriggerBrowserSingle num={accountSelectorNum} />
          <NetworkSelectorTriggerBrowserSingle num={accountSelectorNum} />
        </HeaderButtonGroup>
      </AccountSelectorProviderMirror>
    );
  }, [accountSelectorNum, origin, isLoading]);

  return <>{content}</>;
}

export default withBrowserProvider(HeaderRightToolBar);
