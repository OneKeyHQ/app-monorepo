import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Popover,
  SizableText,
  Skeleton,
  Spinner,
  Stack,
  XStack,
  YStack,
  useMedia,
  usePopoverContext,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import {
  AccountSelectorProviderMirror,
  NetworkSelectorTriggerBrowserSingle,
} from '@onekeyhq/kit/src/components/AccountSelector';
import { AccountSelectorTriggerBrowserSingle } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerDApp';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IConnectionAccountInfoWithNum } from '@onekeyhq/shared/types/dappConnection';

import { DAppAccountListItem } from '../../../DAppConnection/components/DAppAccountList';
import { useHandleDiscoveryAccountChanged } from '../../../DAppConnection/hooks/useHandleAccountChanged';
import { useShouldUpdateConnectedAccount } from '../../hooks/useDAppNotifyChanges';
import { useActiveTabId, useWebTabDataById } from '../../hooks/useWebTabs';
import { withBrowserProvider } from '../../pages/Browser/WithBrowserProvider';
import { SyncDappAccountToHomeProvider } from '../SyncDappAccountToHomeProvider';

import { ShortcutsActionButton } from './ShortcutsActionButton';

import type { IHandleAccountChangedParams } from '../../../DAppConnection/hooks/useHandleAccountChanged';

function HeaderRightToolBarSkeleton() {
  const media = useMedia();
  return (
    <XStack gap="$3" alignItems="center">
      {/* Network Selector */}
      <Skeleton width={media.gtMd ? 127 : '$9'} height="$9" borderRadius="$2" />

      {/* Account Selector */}
      <Skeleton
        width={media.gtMd ? 142 : '$9'}
        height={media.gtMd ? '$12' : '$9'}
        borderRadius="$2"
      />
    </XStack>
  );
}

export function SingleAccountAndNetworkSelectorTrigger({
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
    async (accountChangedParams: IHandleAccountChangedParams) => {
      await handleAccountInfoChanged({
        origin,
        accountSelectorNum: num,
        prevAccountInfo: account,
        accountChangedParams,
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
    <XStack gap="$6" alignItems="center">
      <NetworkSelectorTriggerBrowserSingle
        num={num}
        recordNetworkHistoryEnabled
      />
      <AccountSelectorTriggerBrowserSingle num={num} />
    </XStack>
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
      let indexedAccount: IDBIndexedAccount | undefined;
      if (account.indexedAccountId) {
        indexedAccount =
          await backgroundApiProxy.serviceAccount.getIndexedAccount({
            id: account.indexedAccountId,
          });
      }
      return { account, networkId: accountInfo.networkId, indexedAccount };
    });
    return Promise.all(promises);
  }, [accountsInfo]);

  return (
    <XStack gap="$4" alignItems="center">
      <XStack role="button" testID="multi-avatar">
        {accounts?.slice(0, 2).map((account, index) => (
          <Stack
            key={index}
            borderWidth={2}
            borderColor="$bgApp"
            ml="$-0.5"
            {...(index === 0 && {
              zIndex: 1,
            })}
          >
            <AccountAvatar
              key={account?.account.id}
              account={account.account}
              size="small"
              zIndex={-index}
              networkId={account?.networkId}
              indexedAccount={account.indexedAccount}
            />
          </Stack>
        ))}
        {accountsInfo.length > 2 ? (
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
        ) : null}
      </XStack>
      <ShortcutsActionButton />
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
  const { handleAccountInfoChanged } = useShouldUpdateConnectedAccount();
  const { closePopover } = usePopoverContext();
  const beforeShowTrigger = useCallback(
    async () => closePopover?.(),
    [closePopover],
  );

  // Safety check: only render if we actually have multiple accounts
  if (!accountsInfo || accountsInfo.length <= 1) {
    return null;
  }

  const availableNetworksMap = accountsInfo.reduce((acc, account) => {
    if (Array.isArray(account.availableNetworkIds)) {
      acc[account.num] = { networkIds: account.availableNetworkIds };
    }
    return acc;
  }, {} as Record<number, { networkIds: string[] }>);

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.discover,
        sceneUrl: origin,
      }}
      enabledNum={accountsInfo.map((account) => account.num)}
      availableNetworksMap={availableNetworksMap}
    >
      <YStack p="$5" gap="$2">
        {accountsInfo.map((account) => (
          <DAppAccountListItem
            key={account.num}
            num={account.num}
            // compressionUiMode
            beforeShowTrigger={beforeShowTrigger}
            handleAccountChanged={async (accountChangedParams) => {
              await handleAccountInfoChanged({
                origin,
                accountSelectorNum: account.num,
                prevAccountInfo: account,
                accountChangedParams,
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
  const intl = useIntl();

  // Use ref to always get the latest value in callbacks
  const connectedAccountsInfoRef = useRef<
    IConnectionAccountInfoWithNum[] | null
  >(null);
  const originRef = useRef<string | null>(null);

  const {
    result: connectedAccountsInfo,
    isLoading,
    run,
  } = usePromiseResult(
    async () => {
      if (!origin) {
        return;
      }
      const connectedAccount =
        await backgroundApiProxy.serviceDApp.findInjectedAccountByOrigin(
          origin,
        );

      return connectedAccount;
    },
    [origin],
    {
      checkIsFocused: false,
    },
  );

  const afterChangeAccount = useCallback(() => {
    void run();
  }, [run]);

  // Update refs with latest values
  useEffect(() => {
    connectedAccountsInfoRef.current = connectedAccountsInfo || null;
    originRef.current = origin;
  }, [connectedAccountsInfo, origin]);

  useEffect(() => {
    appEventBus.on(EAppEventBusNames.DAppConnectUpdate, afterChangeAccount);
    appEventBus.on(EAppEventBusNames.DAppNetworkUpdate, afterChangeAccount);
    return () => {
      appEventBus.off(EAppEventBusNames.DAppConnectUpdate, afterChangeAccount);
      appEventBus.off(EAppEventBusNames.DAppNetworkUpdate, afterChangeAccount);
    };
  }, [afterChangeAccount]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      setIsOpen(value);
    },
    [setIsOpen],
  );

  const renderPopoverContent = useCallback(() => {
    const currentAccountsInfo = connectedAccountsInfoRef.current;
    const currentOrigin = originRef.current;

    if (
      !currentAccountsInfo ||
      currentAccountsInfo.length <= 1 ||
      !currentOrigin
    ) {
      return null;
    }

    return (
      <AccountSelectorPopoverContent
        origin={currentOrigin}
        accountsInfo={currentAccountsInfo}
        afterChangeAccount={afterChangeAccount}
      />
    );
  }, [afterChangeAccount]);

  const content = useMemo(() => {
    if (isLoading) {
      return <Spinner />;
    }
    if (!connectedAccountsInfo || !origin) {
      return <ShortcutsActionButton />;
    }

    if (connectedAccountsInfo.length === 1) {
      return (
        <Stack
          ml="$6"
          gap="$6"
          $gtMd={{
            width: platformEnv.isNative ? undefined : '100%',
            flexDirection: 'row-reverse',
            alignItems: 'center',
          }}
        >
          <ShortcutsActionButton />
          <SyncDappAccountToHomeProvider
            dAppAccountInfos={connectedAccountsInfo}
            origin={origin}
          />
          {connectedAccountsInfo.map((accountInfo, index) => (
            <AccountSelectorProviderMirror
              key={index}
              config={{
                sceneName: EAccountSelectorSceneName.discover,
                sceneUrl: origin ?? '',
              }}
              enabledNum={[accountInfo.num]}
              availableNetworksMap={{
                [accountInfo.num]: {
                  networkIds: accountInfo.availableNetworkIds,
                },
              }}
            >
              <SingleAccountAndNetworkSelectorTrigger
                origin={origin}
                num={accountInfo.num}
                account={accountInfo}
                afterChangeAccount={afterChangeAccount}
              />
            </AccountSelectorProviderMirror>
          ))}
        </Stack>
      );
    }
    return (
      <Stack ml="$6">
        <Popover
          key={`popover-${connectedAccountsInfo.length}-${connectedAccountsInfo
            .map((a) => a.num)
            .join('-')}`}
          title={intl.formatMessage({
            id: ETranslations.explore_connected_accounts,
          })}
          keepChildrenMounted
          open={isOpen}
          onOpenChange={handleOpenChange}
          renderTrigger={
            <AvatarStackTrigger accountsInfo={connectedAccountsInfo} />
          }
          renderContent={renderPopoverContent}
        />
      </Stack>
    );
  }, [
    isLoading,
    connectedAccountsInfo,
    origin,
    intl,
    isOpen,
    handleOpenChange,
    renderPopoverContent,
    afterChangeAccount,
  ]);

  return <>{content}</>;
}

function HeaderRightToolBarWrapper() {
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

  useEffect(() => {
    const onSwitchNetwork = (event: { state: 'switching' | 'completed' }) => {
      setIsSwitchingNetwork(event.state === 'switching');
    };
    appEventBus.on(EAppEventBusNames.OnSwitchDAppNetwork, onSwitchNetwork);
    return () => {
      appEventBus.off(EAppEventBusNames.OnSwitchDAppNetwork, onSwitchNetwork);
    };
  }, []);

  if (isSwitchingNetwork) {
    return <HeaderRightToolBarSkeleton />;
  }

  return <HeaderRightToolBar />;
}

export default withBrowserProvider(HeaderRightToolBarWrapper);
