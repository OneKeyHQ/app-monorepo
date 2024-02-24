import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Popover,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  usePopoverContext,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerBrowserSingle,
  NetworkSelectorTriggerBrowserSingle,
} from '@onekeyhq/kit/src/components/AccountSelector';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
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

import type { IHandleAccountChangedParams } from '../../../DAppConnection/hooks/useHandleAccountChanged';

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
    async (selectedAccount: IHandleAccountChangedParams) => {
      await handleAccountInfoChanged({
        origin,
        accountSelectorNum: num,
        prevAccountInfo: account,
        selectedAccount,
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
      <NetworkSelectorTriggerBrowserSingle num={num} />
      <AccountSelectorTriggerBrowserSingle num={num} />
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
        networkId: accountInfo.networkId || '',
      });
      return { account, networkId: accountInfo.networkId };
    });
    return Promise.all(promises);
  }, [accountsInfo]);

  return (
    <XStack role="button" testID="multi-avatar">
      {accounts?.slice(0, 2).map((account, index) => (
        <Stack borderWidth={2} borderColor="$bgApp" ml="$-0.5">
          <AccountAvatar
            key={account?.account.id}
            account={account.account}
            size="small"
            zIndex={-index}
            networkId={account?.networkId}
          />
        </Stack>
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
  const { closePopover } = usePopoverContext();
  const beforeShowTrigger = useCallback(
    async () => closePopover?.(),
    [closePopover],
  );
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.discover,
        sceneUrl: origin,
      }}
      enabledNum={accountsInfo.map((account) => account.num)}
    >
      <YStack p="$5" space="$2">
        {accountsInfo.map((account) => (
          <AccountListItem
            key={account.num}
            num={account.num}
            compressionUiMode
            beforeShowTrigger={beforeShowTrigger}
            handleAccountChanged={async (selectedAccount) => {
              await handleAccountInfoChanged({
                origin,
                accountSelectorNum: account.num,
                prevAccountInfo: account,
                selectedAccount,
                storageType: account.storageType,
                afterUpdate: afterChangeAccount,
              });
            }}
          />
        ))}
      </YStack>
    </AccountSelectorProviderMirror>
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
    const updateNetwork = () => {
      console.log('-=====>re runnnnnn');
      void run();
    };
    appEventBus.on(EAppEventBusNames.DAppConnectUpdate, fn);
    appEventBus.on(EAppEventBusNames.DAppNetworkUpdate, updateNetwork);
    return () => {
      appEventBus.off(EAppEventBusNames.DAppConnectUpdate, fn);
      appEventBus.off(EAppEventBusNames.DAppNetworkUpdate, updateNetwork);
    };
  }, [afterChangeAccount, run]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      setIsOpen(value);
    },
    [setIsOpen],
  );

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
              <XStack mr="$-1.5">
                <SingleAccountAndNetworkSelectorTrigger
                  origin={origin}
                  num={accountInfo.num}
                  account={accountInfo}
                  afterChangeAccount={afterChangeAccount}
                />
              </XStack>
            </AccountSelectorProviderMirror>
          ))}
        </>
      );
    }
    return (
      <Popover
        title="Connected Accounts"
        keepChildrenMounted
        open={isOpen}
        onOpenChange={handleOpenChange}
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
  }, [
    isLoading,
    connectedAccountsInfo,
    origin,
    isOpen,
    handleOpenChange,
    afterChangeAccount,
  ]);

  return <>{content}</>;
}

export default withBrowserProvider(HeaderRightToolBar);
