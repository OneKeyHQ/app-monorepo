import { useMemo } from 'react';

import { SizableText, Spinner, XStack } from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/components/src/actions/AccountAvatar';
import { HeaderButtonGroup } from '@onekeyhq/components/src/layouts/Navigation/Header';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerBrowserSingle,
  NetworkSelectorTriggerBrowserSingle,
} from '@onekeyhq/kit/src/components/AccountSelector';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IConnectionAccountInfoWithNum } from '@onekeyhq/shared/types/dappConnection';

import { useActiveTabId, useWebTabDataById } from '../../hooks/useWebTabs';
import { withBrowserProvider } from '../../pages/Browser/WithBrowserProvider';

function AvatarStack({
  accountsInfo,
}: {
  accountsInfo: IConnectionAccountInfoWithNum[];
}) {
  const { result: accounts } = usePromiseResult(() => {
    const promises = accountsInfo.map(async (accountInfo) => {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId: accountInfo.accountId,
        networkId: accountInfo.networkId,
      });
      return account;
    });
    return Promise.all(promises);
  }, [accountsInfo]);

  return (
    <XStack testID="multi-avatar">
      {accounts?.slice(0, 2).map((account, index) => (
        <AccountAvatar
          key={account?.id}
          account={account}
          size="$6"
          ml="$-1"
          zIndex={-index}
        />
      ))}
      {accountsInfo.length > 2 && (
        <XStack
          w="$6"
          h="$6"
          px="$1"
          bg="$bgStrong"
          borderRadius="$2"
          ml="$-1"
          alignItems="center"
        >
          <SizableText size="$bodyMd" color="$text">
            +{accountsInfo.length - 2}
          </SizableText>
        </XStack>
      )}
    </XStack>
  );
}

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
    if (connectedAccountsInfo.length === 1) {
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
    }
    return <AvatarStack accountsInfo={connectedAccountsInfo} />;
  }, [connectedAccountsInfo, origin, isLoading]);

  return <>{content}</>;
}

export default withBrowserProvider(HeaderRightToolBar);
