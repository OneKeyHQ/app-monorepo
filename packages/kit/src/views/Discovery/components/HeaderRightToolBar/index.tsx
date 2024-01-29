import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Popover,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/components/src/actions/AccountAvatar';
import { HeaderButtonGroup } from '@onekeyhq/components/src/layouts/Navigation/Header';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerBrowserSingle,
  NetworkSelectorTriggerBrowserSingle,
} from '@onekeyhq/kit/src/components/AccountSelector';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { type IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IConnectionAccountInfoWithNum } from '@onekeyhq/shared/types/dappConnection';

import { AccountListItem } from '../../../DAppConnection/components/DAppAccountList';
import { useHandleDiscoveryAccountChanged } from '../../../DAppConnection/hooks/useHandleAccountChanged';
import { useShouldUpdateConnectedAccount } from '../../hooks/useDAppNotifyChanges';
import { useActiveTabId, useWebTabDataById } from '../../hooks/useWebTabs';
import { withBrowserProvider } from '../../pages/Browser/WithBrowserProvider';

function SingleAccountAndNetworkSelectorTrigger({
  origin,
  num,
  account,
  afterChangeAccount,
}: {
  origin: string;
  num: number;
  account: IConnectionAccountInfoWithNum;
  afterChangeAccount: () => void;
}) {
  const { handleAccountInfoChanged } = useShouldUpdateConnectedAccount();
  const handleAccountChanged = useCallback(
    async (activeAccount: IAccountSelectorActiveAccountInfo) => {
      await handleAccountInfoChanged({
        origin,
        accountSelectorNum: num,
        prevAccountInfo: account,
        selectedAccount: activeAccount,
        storageType: account.storageType,
        afterUpdate: afterChangeAccount,
      });
    },
    [num, account, afterChangeAccount, handleAccountInfoChanged, origin],
  );

  useHandleDiscoveryAccountChanged({
    num,
    handleAccountChanged,
  });
  return (
    <>
      <AccountSelectorTriggerBrowserSingle num={num} />
      <NetworkSelectorTriggerBrowserSingle num={num} />
    </>
  );
}

function AvatarStackTrigger({
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
    <XStack role="button" testID="multi-avatar">
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

function AccountSelectorPopoverContent({
  origin,
  accountsInfo,
  afterChangeAccount,
}: {
  origin: string;
  accountsInfo: IConnectionAccountInfoWithNum[];
  afterChangeAccount: () => void;
}) {
  useEffect(() => {
    console.log('Mounted AccountSelectorPopoverContent');
    return () => {
      console.log('Unmounted AccountSelectorPopoverContent');
    };
  }, []);
  const { handleAccountInfoChanged } = useShouldUpdateConnectedAccount();
  return (
    <YStack p="$5" space="$2">
      {accountsInfo.map((account) => (
        <AccountSelectorProviderMirror
          key={account.num}
          config={{
            sceneName: EAccountSelectorSceneName.discover,
            sceneUrl: origin,
          }}
          enabledNum={[account.num]}
        >
          <AccountListItem
            key={account.num}
            num={account.num}
            compressionUiMode
            handleAccountChanged={async (activeAccount) => {
              await handleAccountInfoChanged({
                origin,
                accountSelectorNum: account.num,
                prevAccountInfo: account,
                selectedAccount: activeAccount,
                storageType: account.storageType,
                afterUpdate: afterChangeAccount,
              });
            }}
          />
        </AccountSelectorProviderMirror>
      ))}
    </YStack>
  );
}

function HeaderRightToolBar() {
  const [isOpen, setIsOpen] = useState(false);
  const { activeTabId } = useActiveTabId();
  const { tab } = useWebTabDataById(activeTabId ?? '');
  const origin = tab?.url ? new URL(tab.url).origin : null;
  const {
    result: connectedAccountsInfo,
    isLoading,
    run,
  } = usePromiseResult(async () => {
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

  const afterChangeAccount = useCallback(() => {
    void run();
  }, [run]);

  useEffect(() => {
    const fn = () => {
      setTimeout(() => afterChangeAccount(), 200);
    };
    appEventBus.on(EAppEventBusNames.DAppConnectUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.DAppConnectUpdate, fn);
    };
  }, [afterChangeAccount]);

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
                <SingleAccountAndNetworkSelectorTrigger
                  origin={origin}
                  num={accountInfo.num}
                  account={accountInfo}
                  afterChangeAccount={afterChangeAccount}
                />
              </HeaderButtonGroup>
            </AccountSelectorProviderMirror>
          ))}
        </>
      );
    }
    return (
      <Popover
        title="Popover Demo"
        keepChildrenMounted
        open={isOpen}
        onOpenChange={setIsOpen}
        renderTrigger={
          <AvatarStackTrigger accountsInfo={connectedAccountsInfo} />
        }
        renderContent={
          <AccountSelectorPopoverContent
            origin={origin}
            accountsInfo={connectedAccountsInfo}
            afterChangeAccount={afterChangeAccount}
          />
        }
      />
    );
  }, [connectedAccountsInfo, origin, isLoading, isOpen, afterChangeAccount]);

  return <>{content}</>;
}

export default withBrowserProvider(HeaderRightToolBar);
