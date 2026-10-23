import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
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
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveAccount,
  useIsAccountSelectorSyncLoading,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { shouldRedirectOnboardingToTravelMode } from '@onekeyhq/kit/src/utils/onboardingEntryGate';
import { useToOnBoardingPage } from '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage';
import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IConnectionAccountInfoWithNum } from '@onekeyhq/shared/types/dappConnection';

import { DAppAccountListItem } from '../../../DAppConnection/components/DAppAccountList';
import { useHandleDiscoveryAccountChanged } from '../../../DAppConnection/hooks/useHandleAccountChanged';
import { useShouldUpdateConnectedAccount } from '../../hooks/useDAppNotifyChanges';
import { useActiveTabId, useWebTabDataById } from '../../hooks/useWebTabs';
import { withBrowserProvider } from '../../pages/Browser/WithBrowserProvider';
import { logBrowserChromeAction } from '../MobileBrowser/browserChrome';
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
  compact,
}: {
  origin: string;
  num: number;
  account: IConnectionAccountInfoWithNum;
  afterChangeAccount: () => void;
  // Mobile browser header chip: the account with its network as a badge (the
  // network switch lives in the bottom bar menu).
  compact?: boolean;
}) {
  const { handleAccountInfoChanged } = useShouldUpdateConnectedAccount();
  const handleAccountChanged = useCallback(
    async (accountChangedParams: IHandleAccountChangedParams) =>
      handleAccountInfoChanged({
        origin,
        accountSelectorNum: num,
        prevAccountInfo: account,
        accountChangedParams,
        storageType: account.storageType,
        afterUpdate: afterChangeAccount,
      }),
    [num, account, afterChangeAccount, handleAccountInfoChanged, origin],
  );

  useHandleDiscoveryAccountChanged({
    num,
    handleAccountChanged,
  });
  if (compact) {
    return <CompactConnectedAccountTrigger num={num} />;
  }
  return (
    <XStack gap="$6" alignItems="center" $platform-native={{ gap: '$2' }}>
      <NetworkSelectorTriggerBrowserSingle
        num={num}
        recordNetworkHistoryEnabled
      />
      <AccountSelectorTriggerBrowserSingle num={num} />
    </XStack>
  );
}

// The chevron that closes every header chip. Nudged down: a "v" carries its
// weight at the top, so a geometrically centered one reads high; next to
// badged avatars (badges hang 4pt below the avatar) it follows their lower
// visual center too.
function ChipChevron({ badged }: { badged?: boolean }) {
  return (
    <Icon
      name="ChevronDownSmallOutline"
      color="$iconSubdued"
      size="$4"
      y={badged ? 2 : 1}
    />
  );
}

// The connected account in the mobile browser header chip: avatar, name and
// chevron, the same shape as the not-connected chip. The network badge on the
// avatar is what marks the site as connected (a connection is always on a
// chain; the not-connected chip has no badge). Opens the dApp account
// selector (same options as AccountSelectorTriggerBrowserSingle).
function CompactConnectedAccountTrigger({ num }: { num: number }) {
  const intl = useIntl();
  const {
    activeAccount: { account, indexedAccount, network },
    showAccountSelector,
  } = useAccountSelectorTrigger({
    num,
    linkNetwork: true,
    hideNonBackedUpWallet: true,
  });
  const accountName =
    account?.name ||
    intl.formatMessage({ id: ETranslations.wallet_no_address });
  return (
    <XStack
      role="button"
      gap="$1.5"
      pl="$0.5"
      pr="$1"
      alignItems="center"
      onPress={() => {
        logBrowserChromeAction('account', 'header');
        showAccountSelector();
      }}
      testID="browser-header-connected-account"
    >
      <AccountAvatar
        size="small"
        account={account}
        indexedAccount={indexedAccount}
        networkId={network?.id}
      />
      <SizableText size="$bodyMdMedium" numberOfLines={1} maxWidth={120}>
        {accountName}
      </SizableText>
      <ChipChevron badged />
    </XStack>
  );
}

// Compact version of the home account trigger for the browser header chip:
// avatar + account name. Opens the same home-scene account selector.
function CompactWalletAccountTrigger() {
  const intl = useIntl();
  const {
    activeAccount: { account, indexedAccount, network },
  } = useActiveAccount({ num: 0 });
  const linkNetwork = !network?.isAllNetworks;
  const { showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    editable: true,
    keepAllOtherAccounts: true,
    allowSelectEmptyAccount: true,
    hideAddress: true,
    linkNetwork,
    linkNetworkId: linkNetwork ? network?.id : undefined,
  });
  const accountName =
    indexedAccount?.name ||
    account?.name ||
    intl.formatMessage({ id: ETranslations.no_account });

  return (
    <XStack
      role="button"
      gap="$1.5"
      pl="$0.5"
      pr="$1"
      alignItems="center"
      onPress={() => {
        logBrowserChromeAction('account', 'header');
        showAccountSelector();
      }}
      testID="browser-header-account"
    >
      <AccountAvatar
        size="small"
        account={account}
        indexedAccount={indexedAccount}
      />
      <SizableText size="$bodyMdMedium" numberOfLines={1} maxWidth={140}>
        {accountName}
      </SizableText>
      <ChipChevron />
    </XStack>
  );
}

// Mobile, site not connected: the active wallet account, or an onboarding
// entry when there is no usable wallet yet.
function WalletAccountOrOnboardingEntry() {
  const intl = useIntl();
  const {
    activeAccount: { wallet, account },
  } = useActiveAccount({ num: 0 });
  const isSyncLoading = useIsAccountSelectorSyncLoading(0);
  const toOnBoardingPage = useToOnBoardingPage();

  if (!accountUtils.hasNoUsableWallet({ wallet, account })) {
    return <CompactWalletAccountTrigger />;
  }
  if (isSyncLoading) {
    return <Spinner size="small" />;
  }
  const disabled = shouldRedirectOnboardingToTravelMode();
  return (
    <XStack
      role="button"
      gap="$1.5"
      px="$1.5"
      alignItems="center"
      opacity={disabled ? 0.5 : 1}
      onPress={
        disabled
          ? undefined
          : () => {
              logBrowserChromeAction('createWallet', 'header');
              void toOnBoardingPage();
            }
      }
      testID="browser-header-create-wallet"
    >
      <Icon name="WalletOutline" size="$5" color="$text" />
      <SizableText size="$bodyMdMedium" numberOfLines={1}>
        {intl.formatMessage({
          id: ETranslations.onboarding_create_or_import_wallet,
        })}
      </SizableText>
    </XStack>
  );
}

function AvatarStackTrigger({
  accountsInfo,
  compact,
}: {
  accountsInfo: IConnectionAccountInfoWithNum[];
  // Mobile browser header chip: avatars side by side (an app-background ring
  // would clash with the page-tinted chip) and a chevron for the popover.
  compact?: boolean;
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
      <XStack
        role="button"
        testID="multi-avatar"
        alignItems="center"
        gap={compact ? '$0.5' : undefined}
        pl={compact ? '$0.5' : undefined}
        pr={compact ? '$1' : undefined}
      >
        {accounts?.slice(0, 2).map((account, index) => (
          <Stack
            key={index}
            borderWidth={compact ? 0 : 2}
            borderColor="$bgApp"
            ml={compact ? undefined : '$-0.5'}
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
            ml={compact ? undefined : '$-1'}
            alignItems="center"
            justifyContent="center"
          >
            <SizableText size="$bodyMd" color="$text">
              +{accountsInfo.length - 2}
            </SizableText>
          </XStack>
        ) : null}
        {compact ? (
          <Stack ml="$1">
            <ChipChevron badged />
          </Stack>
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

  const availableNetworksMap = accountsInfo.reduce(
    (acc, account) => {
      if (Array.isArray(account.availableNetworkIds)) {
        acc[account.num] = { networkIds: account.availableNetworkIds };
      }
      return acc;
    },
    {} as Record<number, { networkIds: string[] }>,
  );

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.discover,
        sceneUrl: origin,
      }}
      enabledNum={accountsInfo.map((account) => account.num)}
      availableNetworksMap={availableNetworksMap}
    >
      {/* On phones the popover is a sheet whose header already pads 20pt
          below the title; skip the top padding so the list doesn't sit 40pt
          under it. */}
      <YStack p="$5" $md={{ pt: '$0' }} gap="$2">
        {accountsInfo.map((account) => (
          <DAppAccountListItem
            key={account.num}
            num={account.num}
            // compressionUiMode
            beforeShowTrigger={beforeShowTrigger}
            handleAccountChanged={(accountChangedParams) =>
              handleAccountInfoChanged({
                origin,
                accountSelectorNum: account.num,
                prevAccountInfo: account,
                accountChangedParams,
                storageType: account.storageType,
                afterUpdate: afterChangeAccount,
              })
            }
          />
        ))}
      </YStack>
    </AccountSelectorProviderMirror>
  );
}

interface IHeaderRightToolBarProps {
  // Mobile browser header chip: when the site has no connected account,
  // still show the active wallet account (from the surrounding home-scene
  // account selector); connected accounts carry their network as a badge.
  variant?: 'mobileBrowser';
}

function HeaderRightToolBar({ variant }: IHeaderRightToolBarProps) {
  const isMobileBrowser = variant === 'mobileBrowser';
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
    if (!connectedAccountsInfo?.length || !origin) {
      if (isMobileBrowser) {
        return <WalletAccountOrOnboardingEntry />;
      }
      return <ShortcutsActionButton />;
    }

    if (connectedAccountsInfo.length === 1) {
      return (
        <Stack
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
                compact={isMobileBrowser}
              />
            </AccountSelectorProviderMirror>
          ))}
        </Stack>
      );
    }
    return (
      <Stack>
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
            <AvatarStackTrigger
              accountsInfo={connectedAccountsInfo}
              compact={isMobileBrowser}
            />
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
    isMobileBrowser,
  ]);

  return <>{content}</>;
}

function HeaderRightToolBarWrapper(props: IHeaderRightToolBarProps) {
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

  return <HeaderRightToolBar {...props} />;
}

export default withBrowserProvider<IHeaderRightToolBarProps>(
  HeaderRightToolBarWrapper,
);
